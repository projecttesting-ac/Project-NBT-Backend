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

  // =========================================================
  // CREATE COMMENT / REPLY
  // =========================================================

  async createComment(
    userId: string,
    postId: string,
    content: string,
    parentCommentId?: string,
  ) {
    if (!content || !content.trim()) {
      throw new BadRequestException(
        'Comment content cannot be empty.',
      );
    }

    const trimmedContent =
      content.trim();

    // -------------------------------------------------------
    // CHECK POST
    // -------------------------------------------------------

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

    // -------------------------------------------------------
    // CHECK PARENT COMMENT IF THIS IS A REPLY
    // -------------------------------------------------------

    let parentComment: {
      id: string;
      post_id: string;
      user_id: string;
    } | null = null;

    if (parentCommentId) {
      const {
        data,
        error: parentCommentError,
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

      parentComment = data;
    }

    // -------------------------------------------------------
    // CREATE COMMENT / REPLY
    // -------------------------------------------------------

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

    // =======================================================
    // COMMENT / REPLY NOTIFICATION
    // =======================================================

    if (parentComment) {
      // -----------------------------------------------------
      // REPLY NOTIFICATION
      // -----------------------------------------------------
      //
      // User B replies to User A's comment.
      // User A receives COMMENT_REPLY.
      //

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
      // -----------------------------------------------------
      // COMMENT NOTIFICATION
      // -----------------------------------------------------
      //
      // User B comments on User A's post.
      // User A receives POST_COMMENT.
      //

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

    // =======================================================
    // @MENTION NOTIFICATION
    // =======================================================
    //
    // Example:
    //
    // "@john what do you think?"
    //
    // Creates:
    //
    // MENTION_COMMENT
    //
    // Invalid usernames are ignored.
    // Duplicate mentions are ignored.
    // Self mentions are ignored.
    //
    // Notification failure does not break
    // comment/reply creation.
    //
    // =======================================================

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

  // =========================================================
  // GET COMMENTS
  // =========================================================

  async getComments(
    postId: string,
    userId: string,
    pagination: PaginationDto,
  ) {
    // -------------------------------------------------------
    // CHECK WHETHER POST EXISTS
    // -------------------------------------------------------

    const {
      data: post,
      error: postError,
    } = await supabase
      .from('posts')
      .select('id')
      .eq(
        'id',
        postId,
      )
      .eq(
        'is_deleted',
        false,
      )
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

    // -------------------------------------------------------
    // PAGINATION
    // -------------------------------------------------------

    const page =
      pagination.page;

    const limit =
      pagination.limit;

    const from =
      (page - 1) * limit;

    const to =
      from + limit - 1;

    // -------------------------------------------------------
    // GET COMMENTS
    // -------------------------------------------------------

    const {
      data: comments,
      error,
      count: total,
    } = await supabase
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
      )
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

  // =========================================================
  // DELETE COMMENT / REPLY
  // =========================================================

  async deleteComment(
    userId: string,
    postId: string,
    commentId: string,
  ) {
    // -------------------------------------------------------
    // CHECK COMMENT OWNERSHIP
    // -------------------------------------------------------

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

    // -------------------------------------------------------
    // FIND COMMENT + ALL REPLIES
    // -------------------------------------------------------

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

    // -------------------------------------------------------
    // SOFT DELETE COMMENT TREE
    // -------------------------------------------------------

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

  // =========================================================
  // UPDATE COMMENT / REPLY
  // =========================================================

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

    const {
      data,
      error,
    } = await supabase
      .from('post_comments')
      .update({
        content:
          content.trim(),
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

    return {
      success: true,
      message:
        'Comment updated successfully.',
      data,
    };
  }
}