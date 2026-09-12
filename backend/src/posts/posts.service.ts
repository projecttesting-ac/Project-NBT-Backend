import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import { supabase } from '../config/supabase';
import { PaginationDto } from '../common/dto/pagination.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PostsService {

  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  // =========================================================
// CREATE POST
// =========================================================

async createPost(
  userId: string,
  content: string,
) {
  if (!content || !content.trim()) {
    throw new BadRequestException(
      'Post content cannot be empty.',
    );
  }

  const trimmedContent =
    content.trim();

  const {
    data,
    error,
  } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      content: trimmedContent,
    })
    .select()
    .single();

  if (error) {
    throw new BadRequestException(
      error.message,
    );
  }

  // =======================================================
  // CREATE MENTION NOTIFICATIONS
  // =======================================================

  await this.notificationsService
    .notifyMentionedUsers(
      trimmedContent,
      userId,
      data.id,
      'POST',
    );

  return {
    success: true,
    message:
      'Post created successfully.',
    data,
  };
}

  // =========================================================
  // UPDATE POST
  // =========================================================

  async updatePost(
    userId: string,
    postId: string,
    dto: { content: string },
  ) {
    if (!dto.content || !dto.content.trim()) {
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
        content: dto.content.trim(),
        is_edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)
      .eq('user_id', userId)
      .eq('is_deleted', false)
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
      message: 'Post updated successfully.',
      data,
    };
  }

  // =========================================================
  // GET POSTS
  // =========================================================

  async getPosts(
    pagination: PaginationDto,
    userId?: string,
  ) {
    const page = pagination.page;
    const limit = pagination.limit;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const {
      data: posts,
      error,
      count: total,
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
        {
          count: 'exact',
        },
      )
      .eq('is_deleted', false)
      .order('created_at', {
        ascending: false,
      })
      .range(from, to);

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    // Get likes, comments and saves
    // for these posts
    const postIds = (posts ?? []).map(
      (post) => post.id,
    );

    let likes: any[] = [];
    let comments: any[] = [];
    let saves: any[] = [];

    if (postIds.length > 0) {

      // -------------------------------------------------------
      // GET LIKES
      // -------------------------------------------------------

      const {
        data: likesData,
        error: likesError,
      } = await supabase
        .from('post_likes')
        .select('post_id, user_id')
        .in('post_id', postIds);

      if (likesError) {
        throw new BadRequestException(
          likesError.message,
        );
      }

      likes = likesData ?? [];

      // -------------------------------------------------------
      // GET COMMENTS
      // -------------------------------------------------------

      const {
        data: commentsData,
        error: commentsError,
      } = await supabase
        .from('post_comments')
        .select('post_id')
        .in('post_id', postIds)
        .eq('is_deleted', false);

      if (commentsError) {
        throw new BadRequestException(
          commentsError.message,
        );
      }

      comments = commentsData ?? [];

      // -------------------------------------------------------
      // GET SAVES
      // -------------------------------------------------------

      const {
        data: savesData,
        error: savesError,
      } = await supabase
        .from('post_saves')
        .select('post_id, user_id')
        .in('post_id', postIds);

      if (savesError) {
        throw new BadRequestException(
          savesError.message,
        );
      }

      saves = savesData ?? [];
    }

    // Add:
    // likesCount
    // isLiked
    // commentsCount
    // savesCount
    // isSaved

    const postsWithCounts = (posts ?? []).map(
      (post) => {

        // -----------------------------------------------------
        // LIKES
        // -----------------------------------------------------

        const postLikes = likes.filter(
          (like) =>
            like.post_id === post.id,
        );

        // -----------------------------------------------------
        // COMMENTS
        // -----------------------------------------------------

        const commentsCount = comments.filter(
          (comment) =>
            comment.post_id === post.id,
        ).length;

        // -----------------------------------------------------
        // SAVES
        // -----------------------------------------------------

        const postSaves = saves.filter(
          (save) =>
            save.post_id === post.id,
        );

        const savesCount = postSaves.length;

        // -----------------------------------------------------
        // RETURN POST
        // -----------------------------------------------------

        return {
          ...post,

          likesCount:
            postLikes.length,

          isLiked: userId
            ? postLikes.some(
                (like) =>
                  like.user_id === userId,
              )
            : false,

          commentsCount,

          savesCount,

          isSaved: userId
            ? postSaves.some(
                (save) =>
                  save.user_id === userId,
              )
            : false,
        };
      },
    );

    const totalCount = total ?? 0;

    const totalPages =
      totalCount > 0
        ? Math.ceil(
            totalCount / limit,
          )
        : 0;

    return {
      success: true,

      posts: postsWithCounts,

      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,

        hasNextPage:
          page < totalPages,

        hasPreviousPage:
          page > 1,
      },
    };
  }

  // =========================================================
  // GET SINGLE POST
  // =========================================================

  async getPostById(
    postId: string,
    userId: string,
  ) {
    // -------------------------------------------------------
    // GET POST
    // -------------------------------------------------------

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
      .eq('id', postId)
      .eq('is_deleted', false)
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

    // -------------------------------------------------------
    // GET LIKES
    // -------------------------------------------------------

    const {
      data: likes,
      error: likesError,
    } = await supabase
      .from('post_likes')
      .select('user_id')
      .eq('post_id', postId);

    if (likesError) {
      throw new BadRequestException(
        likesError.message,
      );
    }

    const postLikes = likes ?? [];

    const likesCount =
      postLikes.length;

    const isLiked =
      postLikes.some(
        (like) =>
          like.user_id === userId,
      );

    // -------------------------------------------------------
    // GET COMMENTS COUNT
    // -------------------------------------------------------

    const {
      count: commentsCount,
      error: commentsError,
    } = await supabase
      .from('post_comments')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('post_id', postId)
      .eq('is_deleted', false);

    if (commentsError) {
      throw new BadRequestException(
        commentsError.message,
      );
    }

    // -------------------------------------------------------
    // GET SAVES
    // -------------------------------------------------------

    const {
      data: saves,
      error: savesError,
    } = await supabase
      .from('post_saves')
      .select('user_id')
      .eq('post_id', postId);

    if (savesError) {
      throw new BadRequestException(
        savesError.message,
      );
    }

    const postSaves = saves ?? [];

    const savesCount =
      postSaves.length;

    const isSaved =
      postSaves.some(
        (save) =>
          save.user_id === userId,
      );

    // -------------------------------------------------------
    // RESPONSE
    // -------------------------------------------------------

    return {
      success: true,

      data: {
        ...data,

        likesCount,

        isLiked,

        commentsCount:
          commentsCount ?? 0,

        savesCount,

        isSaved,
      },
    };
  }

  // =========================================================
  // DELETE POST
  // =========================================================

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
        is_deleted: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)
      .eq('user_id', userId)
      .eq('is_deleted', false)
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
      message: 'Post deleted successfully.',
      data,
    };
  }

  // =========================================================
  // INCREMENT POST VIEW
  // =========================================================

  async viewPost(
    userId: string,
    postId: string,
  ) {
    const {
      data,
      error,
    } = await supabase.rpc(
      'record_post_view',
      {
        p_post_id: postId,
        p_user_id: userId,
      },
    );

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    const result = data?.[0];

    if (!result) {
      throw new BadRequestException(
        'Unable to record post view.',
      );
    }

    return {
      success: true,

      message: result.viewed
        ? 'Post viewed successfully.'
        : 'Post already viewed.',

      viewsCount:
        result.views_count,
    };
  }

  // =========================================================
  // LIKE POST
  // =========================================================

  async likePost(
    userId: string,
    postId: string,
  ) {
    // Check post exists
    const {
      data: post,
      error: postError,
    } = await supabase
      .from('posts')
      .select('id, user_id')
      .eq('id', postId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (postError) {
      throw new BadRequestException(
        postError.message,
      );
    }

    if (!post) {
      throw new BadRequestException(
        'Post not found.',
      );
    }

    // Check whether user already liked it
    const {
      data: existingLike,
      error: likeCheckError,
    } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    if (likeCheckError) {
      throw new BadRequestException(
        likeCheckError.message,
      );
    }

    if (existingLike) {
      return {
        success: true,
        message: 'Post already liked.',
      };
    }

    // Create like
    const {
      data,
      error,
    } = await supabase
      .from('post_likes')
      .insert({
        post_id: postId,
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    // =======================================================
    // CREATE POST LIKE NOTIFICATION
    // =======================================================

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
      message: 'Post liked successfully.',
      data,
    };
  }

  // =========================================================
  // UNLIKE POST
  // =========================================================

  async unlikePost(
    userId: string,
    postId: string,
  ) {
    const {
      data,
      error,
    } = await supabase
      .from('post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)
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
        ? 'Post unliked successfully.'
        : 'Post was not liked.',
      data,
    };
  }

  // =========================================================
  // SAVE POST
  // =========================================================

  async savePost(
    userId: string,
    postId: string,
  ) {
    // Check post exists
    const {
      data: post,
      error: postError,
    } = await supabase
      .from('posts')
      .select('id')
      .eq('id', postId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (postError) {
      throw new BadRequestException(
        postError.message,
      );
    }

    if (!post) {
      throw new BadRequestException(
        'Post not found.',
      );
    }

    // Check whether user already saved it
    const {
      data: existingSave,
      error: saveCheckError,
    } = await supabase
      .from('post_saves')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    if (saveCheckError) {
      throw new BadRequestException(
        saveCheckError.message,
      );
    }

    if (existingSave) {
      return {
        success: true,
        message: 'Post already saved.',
      };
    }

    // Create save
    const {
      data,
      error,
    } = await supabase
      .from('post_saves')
      .insert({
        post_id: postId,
        user_id: userId,
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
      message: 'Post saved successfully.',
      data,
    };
  }

  // =========================================================
  // UNSAVE POST
  // =========================================================

  async unsavePost(
    userId: string,
    postId: string,
  ) {
    const {
      data,
      error,
    } = await supabase
      .from('post_saves')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)
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