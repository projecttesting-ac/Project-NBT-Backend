import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import { supabase } from '../config/supabase';
import { PaginationDto } from '../common/dto/pagination.dto';
import { NotificationsService } from '../notifications/notifications.service';

import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostsService {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  private async getBlockedUserIds(
    userId: string,
  ): Promise<string[]> {
    const [
      blockedByMeResult,
      blockedMeResult,
    ] = await Promise.all([
      supabase
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', userId),

      supabase
        .from('blocks')
        .select('blocker_id')
        .eq('blocked_id', userId),
    ]);

    if (blockedByMeResult.error) {
      throw new BadRequestException(
        blockedByMeResult.error.message,
      );
    }

    if (blockedMeResult.error) {
      throw new BadRequestException(
        blockedMeResult.error.message,
      );
    }

    return [
      ...(blockedByMeResult.data ?? []).map(
        (item) => item.blocked_id,
      ),
      ...(blockedMeResult.data ?? []).map(
        (item) => item.blocker_id,
      ),
    ];
  }

  private async validatePostAccess(
    userId: string,
    postId: string,
  ) {
    const {
      data: post,
      error,
    } = await supabase
      .from('posts')
      .select(
        'id, user_id, visibility, is_deleted',
      )
      .eq('id', postId)
      .eq('is_deleted', false)
      .eq('visibility', 'public')
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    if (!post) {
      throw new BadRequestException(
        'Post not found.',
      );
    }

    if (post.user_id !== userId) {
      const blockedUserIds =
        await this.getBlockedUserIds(
          userId,
        );

      if (
        blockedUserIds.includes(
          post.user_id,
        )
      ) {
        throw new BadRequestException(
          'You cannot access this post.',
        );
      }
    }

    return post;
  }

  private async getPostMedia(
    postIds: string[],
  ) {
    if (
      !postIds ||
      postIds.length === 0
    ) {
      return {};
    }

    const {
      data,
      error,
    } = await supabase
      .from('post_attachments')
      .select(
        `
        id,
        post_id,
        media_id,
        sort_order,
        media_files!inner (
          id,
          original_name,
          mime_type,
          size_bytes,
          width,
          height,
          duration_seconds
        )
        `,
      )
      .in(
        'post_id',
        postIds,
      )
      .order(
        'sort_order',
        {
          ascending: true,
        },
      );

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    const mediaByPost: Record<
      string,
      any[]
    > = {};

    for (
      const attachment of data ?? []
    ) {
      const postId =
        attachment.post_id;

      if (
        !mediaByPost[postId]
      ) {
        mediaByPost[postId] = [];
      }

      const media =
        attachment.media_files as any;

      mediaByPost[postId].push({
        id: media.id,
        attachmentId:
          attachment.id,
        originalName:
          media.original_name,
        mimeType:
          media.mime_type,
        sizeBytes:
          media.size_bytes,
        width:
          media.width,
        height:
          media.height,
        durationSeconds:
          media.duration_seconds,
        sortOrder:
          attachment.sort_order,
      });
    }

    return mediaByPost;
  }

  async createPost(
    userId: string,
    dto: CreatePostDto,
  ) {
    const trimmedContent =
      dto.content?.trim() ?? '';

    const mediaIds = [
      ...new Set(
        dto.mediaIds ?? [],
      ),
    ];

    if (
      !trimmedContent &&
      mediaIds.length === 0
    ) {
      throw new BadRequestException(
        'Post must contain text or media.',
      );
    }

    if (
      mediaIds.length > 0
    ) {
      const {
        data: mediaFiles,
        error: mediaError,
      } = await supabase
        .from('media_files')
        .select(
          `
          id,
          owner_id
          `,
        )
        .in(
          'id',
          mediaIds,
        );

      if (mediaError) {
        throw new BadRequestException(
          mediaError.message,
        );
      }

      if (
        !mediaFiles ||
        mediaFiles.length !==
          mediaIds.length
      ) {
        throw new BadRequestException(
          'One or more media files were not found.',
        );
      }

      const unauthorizedMedia =
        mediaFiles.some(
          (media) =>
            media.owner_id !==
            userId,
        );

      if (unauthorizedMedia) {
        throw new BadRequestException(
          'You can only attach media that belongs to you.',
        );
      }
    }

    const {
      data: post,
      error: postError,
    } = await supabase
      .from('posts')
      .insert({
        user_id: userId,
        content:
          trimmedContent ||
          null,
      })
      .select()
      .single();

    if (postError) {
      throw new BadRequestException(
        postError.message,
      );
    }

    if (
      mediaIds.length > 0
    ) {
      const attachments =
        mediaIds.map(
          (
            mediaId,
            index,
          ) => ({
            post_id:
              post.id,
            media_id:
              mediaId,
            sort_order:
              index,
          }),
        );

      const {
        error:
          attachmentError,
      } = await supabase
        .from(
          'post_attachments',
        )
        .insert(
          attachments,
        );

      if (attachmentError) {
        await supabase
          .from('posts')
          .delete()
          .eq(
            'id',
            post.id,
          );

        throw new BadRequestException(
          attachmentError.message,
        );
      }
    }

    if (trimmedContent) {
      await this.notificationsService
        .notifyMentionedUsers(
          trimmedContent,
          userId,
          post.id,
          'POST',
        );
    }

    const mediaByPost =
      await this.getPostMedia([
        post.id,
      ]);

    return {
      success: true,
      message:
        'Post created successfully.',
      data: {
        ...post,
        media:
          mediaByPost[
            post.id
          ] ?? [],
      },
    };
  }

  async updatePost(
    userId: string,
    postId: string,
    dto: UpdatePostDto,
  ) {
    if (
      !dto.content ||
      !dto.content.trim()
    ) {
      throw new BadRequestException(
        'Post content cannot be empty.',
      );
    }

    const {
      data,
      error,
    } = await supabase
      .from('posts')
      .update({
        content:
          dto.content.trim(),
        is_edited: true,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        postId,
      )
      .eq(
        'user_id',
        userId,
      )
      .eq(
        'is_deleted',
        false,
      )
      .select()
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    if (!data) {
      throw new BadRequestException(
        'Post not found or you are not the owner.',
      );
    }

    const mediaByPost =
      await this.getPostMedia([
        postId,
      ]);

    return {
      success: true,
      message:
        'Post updated successfully.',
      data: {
        ...data,
        media:
          mediaByPost[
            postId
          ] ?? [],
      },
    };
  }

  async getPosts(
    pagination: PaginationDto,
    userId?: string,
  ) {
    const page =
      pagination.page;

    const limit =
      pagination.limit;

    const from =
      (page - 1) *
      limit;

    const to =
      from +
      limit -
      1;

    let blockedUserIds: string[] =
      [];

    if (userId) {
      blockedUserIds =
        await this.getBlockedUserIds(
          userId,
        );
    }

    let query =
      supabase
        .from('posts')
        .select(
          `
          id,
          user_id,
          content,
          created_at,
          updated_at,
          is_edited,
          is_deleted,
          visibility,
          views_count
          `,
          {
            count:
              'exact',
          },
        )
        .eq(
          'is_deleted',
          false,
        )
        .eq(
          'visibility',
          'public',
        );

    if (
      blockedUserIds.length >
      0
    ) {
      query =
        query.not(
          'user_id',
          'in',
          `(${blockedUserIds.join(',')})`,
        );
    }

    const {
      data: posts,
      error,
      count: total,
    } = await query
      .order(
        'created_at',
        {
          ascending:
            false,
        },
      )
      .range(
        from,
        to,
      );

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    const postIds =
      (posts ?? []).map(
        (post) =>
          post.id,
      );

    let likes: any[] =
      [];

    let comments: any[] =
      [];

    let saves: any[] =
      [];

    if (
      postIds.length >
      0
    ) {
      const {
        data: likesData,
        error:
          likesError,
      } = await supabase
        .from(
          'post_likes',
        )
        .select(
          'post_id, user_id',
        )
        .in(
          'post_id',
          postIds,
        );

      if (likesError) {
        throw new BadRequestException(
          likesError.message,
        );
      }

      likes =
        likesData ??
        [];

      const {
        data:
          commentsData,
        error:
          commentsError,
      } = await supabase
        .from(
          'post_comments',
        )
        .select(
          'post_id',
        )
        .in(
          'post_id',
          postIds,
        )
        .eq(
          'is_deleted',
          false,
        );

      if (commentsError) {
        throw new BadRequestException(
          commentsError.message,
        );
      }

      comments =
        commentsData ??
        [];

      const {
        data:
          savesData,
        error:
          savesError,
      } = await supabase
        .from(
          'post_saves',
        )
        .select(
          'post_id, user_id',
        )
        .in(
          'post_id',
          postIds,
        );

      if (savesError) {
        throw new BadRequestException(
          savesError.message,
        );
      }

      saves =
        savesData ??
        [];
    }

    const mediaByPost =
      await this.getPostMedia(
        postIds,
      );

    const postsWithCounts =
      (
        posts ?? []
      ).map(
        (post) => {
          const postLikes =
            likes.filter(
              (like) =>
                like.post_id ===
                post.id,
            );

          const commentsCount =
            comments.filter(
              (comment) =>
                comment.post_id ===
                post.id,
            ).length;

          const postSaves =
            saves.filter(
              (save) =>
                save.post_id ===
                post.id,
            );

          const savesCount =
            postSaves.length;

          return {
            ...post,

            likesCount:
              postLikes.length,

            isLiked:
              userId
                ? postLikes.some(
                    (like) =>
                      like.user_id ===
                      userId,
                  )
                : false,

            commentsCount,

            savesCount,

            isSaved:
              userId
                ? postSaves.some(
                    (save) =>
                      save.user_id ===
                      userId,
                  )
                : false,

            media:
              mediaByPost[
                post.id
              ] ?? [],
          };
        },
      );

    const totalCount =
      total ?? 0;

    const totalPages =
      totalCount > 0
        ? Math.ceil(
            totalCount /
              limit,
          )
        : 0;

    return {
      success: true,

      posts:
        postsWithCounts,

      pagination: {
        page,
        limit,
        total:
          totalCount,
        totalPages,

        hasNextPage:
          page <
          totalPages,

        hasPreviousPage:
          page > 1,
      },
    };
  }

  async getPostById(
    postId: string,
    userId: string,
  ) {
    await this.validatePostAccess(
      userId,
      postId,
    );

    const {
      data,
      error,
    } = await supabase
      .from('posts')
      .select(
        `
        id,
        user_id,
        content,
        created_at,
        updated_at,
        is_edited,
        is_deleted,
        visibility,
        views_count
        `,
      )
      .eq(
        'id',
        postId,
      )
      .eq(
        'is_deleted',
        false,
      )
      .eq(
        'visibility',
        'public',
      )
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    if (!data) {
      throw new BadRequestException(
        'Post not found.',
      );
    }

    const {
      data: likes,
      error:
        likesError,
    } = await supabase
      .from(
        'post_likes',
      )
      .select(
        'user_id',
      )
      .eq(
        'post_id',
        postId,
      );

    if (likesError) {
      throw new BadRequestException(
        likesError.message,
      );
    }

    const postLikes =
      likes ?? [];

    const likesCount =
      postLikes.length;

    const isLiked =
      postLikes.some(
        (like) =>
          like.user_id ===
          userId,
      );

    const {
      count:
        commentsCount,
      error:
        commentsError,
    } = await supabase
      .from(
        'post_comments',
      )
      .select(
        'id',
        {
          count:
            'exact',
          head: true,
        },
      )
      .eq(
        'post_id',
        postId,
      )
      .eq(
        'is_deleted',
        false,
      );

    if (commentsError) {
      throw new BadRequestException(
        commentsError.message,
      );
    }

    const {
      data: saves,
      error:
        savesError,
    } = await supabase
      .from(
        'post_saves',
      )
      .select(
        'user_id',
      )
      .eq(
        'post_id',
        postId,
      );

    if (savesError) {
      throw new BadRequestException(
        savesError.message,
      );
    }

    const postSaves =
      saves ?? [];

    const savesCount =
      postSaves.length;

    const isSaved =
      postSaves.some(
        (save) =>
          save.user_id ===
          userId,
      );

    const mediaByPost =
      await this.getPostMedia([
        postId,
      ]);

    return {
      success: true,

      data: {
        ...data,

        likesCount,

        isLiked,

        commentsCount:
          commentsCount ??
          0,

        savesCount,

        isSaved,

        media:
          mediaByPost[
            postId
          ] ?? [],
      },
    };
  }

  async deletePost(
    userId: string,
    postId: string,
  ) {
    const {
      data,
      error,
    } = await supabase
      .from('posts')
      .update({
        is_deleted:
          true,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        postId,
      )
      .eq(
        'user_id',
        userId,
      )
      .eq(
        'is_deleted',
        false,
      )
      .select()
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    if (!data) {
      throw new BadRequestException(
        'Post not found or you are not the owner.',
      );
    }

    return {
      success: true,
      message:
        'Post deleted successfully.',
      data,
    };
  }

  async viewPost(
    userId: string,
    postId: string,
  ) {
    await this.validatePostAccess(
      userId,
      postId,
    );

    const {
      data,
      error,
    } = await supabase.rpc(
      'record_post_view',
      {
        p_post_id:
          postId,
        p_user_id:
          userId,
      },
    );

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    const result =
      data?.[0];

    if (!result) {
      throw new BadRequestException(
        'Unable to record post view.',
      );
    }

    return {
      success: true,

      message:
        result.viewed
          ? 'Post viewed successfully.'
          : 'Post already viewed.',

      viewsCount:
        result.views_count,
    };
  }

  async likePost(
    userId: string,
    postId: string,
  ) {
    const post =
      await this.validatePostAccess(
        userId,
        postId,
      );

    const {
      data:
        existingLike,
      error:
        likeCheckError,
    } = await supabase
      .from(
        'post_likes',
      )
      .select('id')
      .eq(
        'post_id',
        postId,
      )
      .eq(
        'user_id',
        userId,
      )
      .maybeSingle();

    if (likeCheckError) {
      throw new BadRequestException(
        likeCheckError.message,
      );
    }

    if (existingLike) {
      return {
        success: true,
        message:
          'Post already liked.',
      };
    }

    const {
      data,
      error,
    } = await supabase
      .from(
        'post_likes',
      )
      .insert({
        post_id:
          postId,
        user_id:
          userId,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    await this.notificationsService
      .tryCreateNotification(
        post.user_id,
        'POST_LIKE',
        'New like',
        'Someone liked your post.',
        userId,
        postId,
        'POST',
      );

    return {
      success: true,
      message:
        'Post liked successfully.',
      data,
    };
  }

  async dislikePost(
    userId: string,
    postId: string,
  ) {
    await this.validatePostAccess(
      userId,
      postId,
    );

    const {
      data,
      error,
    } = await supabase
      .from(
        'post_likes',
      )
      .delete()
      .eq(
        'post_id',
        postId,
      )
      .eq(
        'user_id',
        userId,
      )
      .select()
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    return {
      success: true,
      message: data
        ? 'Post disliked successfully.'
        : 'Post was not liked.',
      data,
    };
  }

  async savePost(
    userId: string,
    postId: string,
  ) {
    await this.validatePostAccess(
      userId,
      postId,
    );

    const {
      data:
        existingSave,
      error:
        saveCheckError,
    } = await supabase
      .from(
        'post_saves',
      )
      .select('id')
      .eq(
        'post_id',
        postId,
      )
      .eq(
        'user_id',
        userId,
      )
      .maybeSingle();

    if (saveCheckError) {
      throw new BadRequestException(
        saveCheckError.message,
      );
    }

    if (existingSave) {
      return {
        success: true,
        message:
          'Post already saved.',
      };
    }

    const {
      data,
      error,
    } = await supabase
      .from(
        'post_saves',
      )
      .insert({
        post_id:
          postId,
        user_id:
          userId,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    return {
      success: true,
      message:
        'Post saved successfully.',
      data,
    };
  }

  async unsavePost(
    userId: string,
    postId: string,
  ) {
    await this.validatePostAccess(
      userId,
      postId,
    );

    const {
      data,
      error,
    } = await supabase
      .from(
        'post_saves',
      )
      .delete()
      .eq(
        'post_id',
        postId,
      )
      .eq(
        'user_id',
        userId,
      )
      .select()
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    return {
      success: true,
      message: data
        ? 'Post unsaved successfully.'
        : 'Post was not saved.',
      data,
    };
  }
}