import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import { PaginationDto } from '../common/dto/pagination.dto';
import { supabase } from '../config/supabase';

@Injectable()
export class CommentsService {

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

    // Check whether the post exists
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

    // If this is a reply, check whether
    // the parent comment exists
    if (parentCommentId) {
      const {
        data: parentComment,
        error: parentCommentError,
      } = await supabase
        .from('post_comments')
        .select('id, post_id')
        .eq('id', parentCommentId)
        .eq('post_id', postId)
        .eq('is_deleted', false)
        .maybeSingle();

      if (parentCommentError) {
        throw new BadRequestException(
          parentCommentError.message,
        );
      }

      if (!parentComment) {
        throw new BadRequestException(
          'Parent comment not found.',
        );
      }
    }

    // Create comment or reply
    const {
      data,
      error,
    } = await supabase
      .from('post_comments')
      .insert({
        post_id: postId,
        user_id: userId,
        content: content.trim(),
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
    // Check whether the post exists
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

    // Pagination
    const page = pagination.page;
    const limit = pagination.limit;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Get comments for this post
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
      .eq('post_id', postId)
      .eq('is_deleted', false)
      .order('created_at', {
        ascending: true,
      })
      .range(from, to);

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    const totalCount = total ?? 0;

    const totalPages =
      totalCount > 0
        ? Math.ceil(
            totalCount / limit,
          )
        : 0;

    return {
      success: true,

      data: comments ?? [],

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
  // DELETE COMMENT / REPLY
  // =========================================================

  async deleteComment(
    userId: string,
    postId: string,
    commentId: string,
  ) {
    // Check that the comment exists
    // and belongs to the current user
    const {
      data: comment,
      error: commentError,
    } = await supabase
      .from('post_comments')
      .select('id, parent_comment_id')
      .eq('id', commentId)
      .eq('post_id', postId)
      .eq('user_id', userId)
      .eq('is_deleted', false)
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

    // Find the selected comment
    // and every reply below it
    const idsToDelete: string[] = [commentId];

    let currentIds: string[] = [commentId];

    while (currentIds.length > 0) {
      const {
        data: replies,
        error: repliesError,
      } = await supabase
        .from('post_comments')
        .select('id')
        .eq('post_id', postId)
        .in('parent_comment_id', currentIds)
        .eq('is_deleted', false);

      if (repliesError) {
        throw new BadRequestException(
          repliesError.message,
        );
      }

      if (!replies || replies.length === 0) {
        break;
      }

      const nextIds = replies.map(
        (reply) => reply.id,
      );

      idsToDelete.push(...nextIds);

      currentIds = nextIds;
    }

    // Soft delete everything
    // in the comment's reply tree
    const {
      data,
      error,
    } = await supabase
      .from('post_comments')
      .update({
        is_deleted: true,
        updated_at: new Date().toISOString(),
      })
      .in('id', idsToDelete)
      .eq('post_id', postId)
      .select();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    return {
      success: true,
      message: 'Comment deleted successfully.',
      data: data?.find(
        (item) => item.id === commentId,
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
    if (!content || !content.trim()) {
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
        content: content.trim(),
        is_edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', commentId)
      .eq('post_id', postId)
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
        'Comment not found or you are not the owner.',
      );
    }

    return {
      success: true,
      message: 'Comment updated successfully.',
      data,
    };
  }
}