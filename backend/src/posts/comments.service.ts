import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import { PaginationDto } from '../common/dto/pagination.dto';
import { supabase } from '../config/supabase';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CommentsService {
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

    if (!post) {
      throw new BadRequestException(
        'Post not found.',
      );
    }

    if (
      post.user_id !== userId
    ) {
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

  async createComment(
    userId: string,
    postId: string,
    content: string,
    parentCommentId?: string,
  ) {
    if (
      !content ||
      !content.trim()
    ) {
      throw new BadRequestException(
        'Comment content cannot be empty.',
      );
    }

    const trimmedContent =
      content.trim();

    const post =
      await this.validatePostAccess(
        userId,
        postId,
      );

    let parentComment: {
      id: string;
      post_id: string;
      user_id: string;
    } | null = null;

    if (parentCommentId) {
      const {
        data,
        error:
          parentCommentError,
      } = await supabase
        .from('post_comments')
        .select(
          'id, post_id, user_id',
        )
        .eq(
          'id',
          parentCommentId,
        )
        .eq(
          'post_id',
          postId,
        )
        .eq(
          'is_deleted',
          false,
        )
        .maybeSingle();

      if (parentCommentError) {
        throw new BadRequestException(
          parentCommentError.message,
        );
      }

      if (!data) {
        throw new BadRequestException(
          'Parent comment not found.',
        );
      }

      const blockedUserIds =
        await this.getBlockedUserIds(
          userId,
        );

      if (
        blockedUserIds.includes(
          data.user_id,
        )
      ) {
        throw new BadRequestException(
          'You cannot reply to this comment.',
        );
      }

      parentComment = data;
    }

    const {
      data,
      error,
    } = await supabase
      .from('post_comments')
      .insert({
        post_id: postId,
        user_id: userId,
        content: trimmedContent,
        parent_comment_id:
          parentCommentId ?? null,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    if (parentComment) {
      await this.notificationsService
        .tryCreateNotification(
          parentComment.user_id,
          'COMMENT_REPLY',
          'New reply',
          'Someone replied to your comment.',
          userId,
          data.id,
          'COMMENT',
        );
    } else {
      await this.notificationsService
        .tryCreateNotification(
          post.user_id,
          'POST_COMMENT',
          'New comment',
          'Someone commented on your post.',
          userId,
          data.id,
          'COMMENT',
        );
    }

    await this.notificationsService
      .notifyMentionedUsers(
        trimmedContent,
        userId,
        data.id,
        'COMMENT',
      );

    return {
      success: true,
      message: parentCommentId
        ? 'Reply created successfully.'
        : 'Comment created successfully.',
      data,
    };
  }

  async getComments(
    postId: string,
    userId: string,
    pagination: PaginationDto,
  ) {
    await this.validatePostAccess(
      userId,
      postId,
    );

    const blockedUserIds =
      await this.getBlockedUserIds(
        userId,
      );

    const page =
      pagination.page;

    const limit =
      pagination.limit;

    const from =
      (page - 1) * limit;

    const to =
      from + limit - 1;

    let query =
      supabase
        .from('post_comments')
        .select(
          `
          id,
          post_id,
          user_id,
          content,
          parent_comment_id,
          created_at,
          updated_at,
          is_edited,
          is_deleted
          `,
          {
            count: 'exact',
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
      data: comments,
      error,
      count: total,
    } = await query
      .order(
        'created_at',
        {
          ascending: true,
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

      data:
        comments ?? [],

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

  async deleteComment(
    userId: string,
    postId: string,
    commentId: string,
  ) {
    await this.validatePostAccess(
      userId,
      postId,
    );

    const {
      data: comment,
      error: commentError,
    } = await supabase
      .from('post_comments')
      .select(
        'id, parent_comment_id',
      )
      .eq(
        'id',
        commentId,
      )
      .eq(
        'post_id',
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
      .maybeSingle();

    if (commentError) {
      throw new BadRequestException(
        commentError.message,
      );
    }

    if (!comment) {
      throw new BadRequestException(
        'Comment not found or you are not the owner.',
      );
    }

    const idsToDelete: string[] = [
      commentId,
    ];

    let currentIds: string[] = [
      commentId,
    ];

    while (
      currentIds.length > 0
    ) {
      const {
        data: replies,
        error: repliesError,
      } = await supabase
        .from('post_comments')
        .select('id')
        .eq(
          'post_id',
          postId,
        )
        .in(
          'parent_comment_id',
          currentIds,
        )
        .eq(
          'is_deleted',
          false,
        );

      if (repliesError) {
        throw new BadRequestException(
          repliesError.message,
        );
      }

      if (
        !replies ||
        replies.length === 0
      ) {
        break;
      }

      const nextIds =
        replies.map(
          (reply) =>
            reply.id,
        );

      idsToDelete.push(
        ...nextIds,
      );

      currentIds =
        nextIds;
    }

    const {
      data,
      error,
    } = await supabase
      .from('post_comments')
      .update({
        is_deleted: true,
        updated_at:
          new Date().toISOString(),
      })
      .in(
        'id',
        idsToDelete,
      )
      .eq(
        'post_id',
        postId,
      )
      .select();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    return {
      success: true,
      message:
        'Comment deleted successfully.',
      data:
        data?.find(
          (item) =>
            item.id ===
            commentId,
        ) ?? null,
    };
  }

  async updateComment(
    userId: string,
    postId: string,
    commentId: string,
    content: string,
  ) {
    if (
      !content ||
      !content.trim()
    ) {
      throw new BadRequestException(
        'Comment content cannot be empty.',
      );
    }

    await this.validatePostAccess(
      userId,
      postId,
    );

    const trimmedContent =
      content.trim();

    const {
      data,
      error,
    } = await supabase
      .from('post_comments')
      .update({
        content:
          trimmedContent,
        is_edited: true,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        commentId,
      )
      .eq(
        'post_id',
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
        'Comment not found or you are not the owner.',
      );
    }

    await this.notificationsService
      .notifyMentionedUsers(
        trimmedContent,
        userId,
        data.id,
        'COMMENT',
      );

    return {
      success: true,
      message:
        'Comment updated successfully.',
      data,
    };
  }
}