import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { supabase } from '../config/supabase';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class BlocksService {
  // =========================================================
  // BLOCK USER
  // =========================================================

  async blockUser(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new BadRequestException(
        'You cannot block yourself.',
      );
    }

    // -------------------------------------------------------
    // CHECK TARGET USER
    // -------------------------------------------------------

    const {
      data: targetUser,
      error: userError,
    } = await supabase
      .from('users')
      .select(
        'id, username, display_name, avatar_url',
      )
      .eq('id', targetUserId)
      .maybeSingle();

    if (userError) {
      throw new BadRequestException(
        userError.message,
      );
    }

    if (!targetUser) {
      throw new NotFoundException(
        'User not found.',
      );
    }

    // -------------------------------------------------------
    // CHECK EXISTING BLOCK
    // -------------------------------------------------------

    const {
      data: existingBlock,
      error: existingError,
    } = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_id', userId)
      .eq('blocked_id', targetUserId)
      .maybeSingle();

    if (existingError) {
      throw new BadRequestException(
        existingError.message,
      );
    }

    if (existingBlock) {
      throw new ConflictException(
        'You have already blocked this user.',
      );
    }

    // -------------------------------------------------------
    // CREATE BLOCK
    // -------------------------------------------------------

    const {
      data: block,
      error: blockError,
    } = await supabase
      .from('blocks')
      .insert({
        blocker_id: userId,
        blocked_id: targetUserId,
      })
      .select('id, blocked_id, created_at')
      .single();

    if (blockError) {
      throw new BadRequestException(
        blockError.message,
      );
    }

    return {
      success: true,
      message: 'User blocked successfully.',
      block: {
        id: block.id,
        userId: block.blocked_id,
        createdAt: block.created_at,
      },
    };
  }

  // =========================================================
  // UNBLOCK USER
  // =========================================================

  async unblockUser(
    userId: string,
    targetUserId: string,
  ) {
    const {
      data: block,
      error: blockError,
    } = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_id', userId)
      .eq('blocked_id', targetUserId)
      .maybeSingle();

    if (blockError) {
      throw new BadRequestException(
        blockError.message,
      );
    }

    if (!block) {
      throw new NotFoundException(
        'Block not found.',
      );
    }

    const {
      error: deleteError,
    } = await supabase
      .from('blocks')
      .delete()
      .eq('id', block.id);

    if (deleteError) {
      throw new BadRequestException(
        deleteError.message,
      );
    }

    return {
      success: true,
      message: 'User unblocked successfully.',
    };
  }

  // =========================================================
  // GET MY BLOCKED USERS
  // =========================================================

  async getBlockedUsers(
    userId: string,
    pagination: PaginationDto,
  ) {
    const page = pagination.page;
    const limit = pagination.limit;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const {
      data: blocks,
      error: blocksError,
      count,
    } = await supabase
      .from('blocks')
      .select(
        `
        id,
        blocked_id,
        created_at,
        users:blocked_id (
          id,
          username,
          display_name,
          bio,
          avatar_url,
          city
        )
        `,
        {
          count: 'exact',
        },
      )
      .eq('blocker_id', userId)
      .order('created_at', {
        ascending: false,
      })
      .range(from, to);

    if (blocksError) {
      throw new BadRequestException(
        blocksError.message,
      );
    }

    const blockedUsers = (blocks ?? []).map(
      (block: any) => ({
        blockId: block.id,
        blockedAt: block.created_at,
        user: {
          id: block.users?.id,
          username: block.users?.username,
          displayName:
            block.users?.display_name,
          bio: block.users?.bio,
          avatarUrl:
            block.users?.avatar_url,
          city: block.users?.city,
        },
      }),
    );

    const total = count ?? 0;

    const totalPages = Math.ceil(
      total / limit,
    );

    return {
      success: true,
      blockedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage:
          page < totalPages,
        hasPreviousPage:
          page > 1,
      },
    };
  }

  // =========================================================
  // CHECK BLOCK STATUS
  // =========================================================

  async getBlockStatus(
    userId: string,
    targetUserId: string,
  ) {
    if (userId === targetUserId) {
      throw new BadRequestException(
        'You cannot check block status against yourself.',
      );
    }

    const {
      data: block,
      error: blockError,
    } = await supabase
      .from('blocks')
      .select(
        'id, blocker_id, blocked_id, created_at',
      )
      .or(
        `and(blocker_id.eq.${userId},blocked_id.eq.${targetUserId}),and(blocker_id.eq.${targetUserId},blocked_id.eq.${userId})`,
      )
      .limit(1)
      .maybeSingle();

    if (blockError) {
      throw new BadRequestException(
        blockError.message,
      );
    }

    if (!block) {
      return {
        success: true,
        isBlocked: false,
        blockedByMe: false,
        blockedByThem: false,
      };
    }

    const blockedByMe =
      block.blocker_id === userId;

    const blockedByThem =
      block.blocker_id === targetUserId;

    return {
      success: true,
      isBlocked: true,
      blockedByMe,
      blockedByThem,
      createdAt: block.created_at,
    };
  }
}