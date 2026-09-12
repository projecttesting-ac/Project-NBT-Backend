import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { supabase } from '../config/supabase';

@Injectable()
export class NotificationsService {

  // ============================================================
  // CREATE NOTIFICATION
  // ============================================================

  async createNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    actorId?: string,
    entityId?: string,
    entityType?: string,
  ) {
    // Never notify a user about their own action.
    if (actorId && actorId === userId) {
      return null;
    }

    const {
      data,
      error,
    } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        actor_id: actorId ?? null,
        type,
        title,
        message: message ?? null,
        entity_id: entityId ?? null,
        entity_type: entityType ?? null,
        is_read: false,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    return data;
  }

  // ============================================================
  // SAFE CREATE NOTIFICATION
  // ============================================================

  async tryCreateNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    actorId?: string,
    entityId?: string,
    entityType?: string,
  ) {
    try {
      return await this.createNotification(
        userId,
        type,
        title,
        message,
        actorId,
        entityId,
        entityType,
      );
    } catch (error) {
      console.error(
        'Notification creation failed:',
        error instanceof Error
          ? error.message
          : error,
      );

      return null;
    }
  }

  // ============================================================
  // NOTIFY MENTIONED USERS
  // ============================================================
  //
  // Example:
  //
  // "Hello @john and @sarah"
  //
  // Creates:
  //
  // MENTION_POST
  // or
  // MENTION_COMMENT
  //
  // depending on entityType.
  //
  // ============================================================

  async notifyMentionedUsers(
    content: string,
    actorId: string,
    entityId: string,
    entityType: 'POST' | 'COMMENT',
  ) {
    if (!content || !content.trim()) {
      return [];
    }

    // ----------------------------------------------------------
    // FIND @USERNAME MENTIONS
    // ----------------------------------------------------------

    const mentionMatches =
      content.match(
        /@[a-zA-Z0-9_]+/g,
      ) ?? [];

    if (mentionMatches.length === 0) {
      return [];
    }

    // ----------------------------------------------------------
    // NORMALIZE USERNAMES
    // ----------------------------------------------------------
    //
    // Your UsersService stores usernames in lowercase.
    //
    // Example:
    //
    // @John_Doe
    // becomes
    // john_doe
    //
    // ----------------------------------------------------------

    const usernames = [
      ...new Set(
        mentionMatches.map(
          (mention) =>
            mention
              .substring(1)
              .trim()
              .toLowerCase(),
        ),
      ),
    ];

    if (usernames.length === 0) {
      return [];
    }

    // ----------------------------------------------------------
    // FIND USERS
    // ----------------------------------------------------------

    const {
      data: users,
      error: usersError,
    } = await supabase
      .from('users')
      .select('id, username')
      .in(
        'username',
        usernames,
      );

    if (usersError) {
      console.error(
        'Mention user lookup failed:',
        usersError.message,
      );

      return [];
    }

    if (!users || users.length === 0) {
      return [];
    }

    // ----------------------------------------------------------
    // NOTIFICATION DETAILS
    // ----------------------------------------------------------

    const notificationType =
      entityType === 'POST'
        ? 'MENTION_POST'
        : 'MENTION_COMMENT';

    const title =
      entityType === 'POST'
        ? 'Mentioned you in a post'
        : 'Mentioned you in a comment';

    const message =
      entityType === 'POST'
        ? 'Someone mentioned you in a post.'
        : 'Someone mentioned you in a comment.';

    const notifications: any[] = [];

    // ----------------------------------------------------------
    // CREATE NOTIFICATIONS
    // ----------------------------------------------------------

    for (const user of users) {

      // Never notify yourself.
      if (user.id === actorId) {
        continue;
      }

      const notification =
        await this.tryCreateNotification(
          user.id,
          notificationType,
          title,
          message,
          actorId,
          entityId,
          entityType,
        );

      if (notification) {
        notifications.push(
          notification,
        );
      }
    }

    return notifications;
  }

  // ============================================================
  // GET MY NOTIFICATIONS
  // ============================================================

  async getMyNotifications(
    userId: string,
    page = 1,
    limit = 20,
  ) {
    const safePage =
      Math.max(1, page);

    const safeLimit =
      Math.min(
        50,
        Math.max(1, limit),
      );

    const from =
      (safePage - 1) *
      safeLimit;

    const to =
      from + safeLimit - 1;

    const {
      data,
      error,
      count,
    } = await supabase
      .from('notifications')
      .select(
        `
        id,
        user_id,
        actor_id,
        type,
        title,
        message,
        entity_id,
        entity_type,
        is_read,
        created_at
        `,
        {
          count: 'exact',
        },
      )
      .eq(
        'user_id',
        userId,
      )
      .order(
        'created_at',
        {
          ascending: false,
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

    const total =
      count ?? 0;

    return {
      success: true,

      notifications:
        data ?? [],

      pagination: {
        page: safePage,
        limit: safeLimit,
        total,

        totalPages:
          total === 0
            ? 0
            : Math.ceil(
                total /
                  safeLimit,
              ),

        hasNextPage:
          safePage *
            safeLimit <
          total,

        hasPreviousPage:
          safePage > 1,
      },
    };
  }

  // ============================================================
  // GET UNREAD COUNT
  // ============================================================

  async getUnreadCount(
    userId: string,
  ) {
    const {
      count,
      error,
    } = await supabase
      .from('notifications')
      .select(
        'id',
        {
          count: 'exact',
          head: true,
        },
      )
      .eq(
        'user_id',
        userId,
      )
      .eq(
        'is_read',
        false,
      );

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    return {
      success: true,
      unreadCount:
        count ?? 0,
    };
  }

  // ============================================================
  // MARK ONE NOTIFICATION AS READ
  // ============================================================

  async markAsRead(
    userId: string,
    notificationId: string,
  ) {
    const {
      data,
      error,
    } = await supabase
      .from('notifications')
      .update({
        is_read: true,
      })
      .eq(
        'id',
        notificationId,
      )
      .eq(
        'user_id',
        userId,
      )
      .select('id')
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    if (!data) {
      throw new NotFoundException(
        'Notification not found.',
      );
    }

    return {
      success: true,
      message:
        'Notification marked as read.',
    };
  }

  // ============================================================
  // MARK ALL NOTIFICATIONS AS READ
  // ============================================================

  async markAllAsRead(
    userId: string,
  ) {
    const {
      error,
    } = await supabase
      .from('notifications')
      .update({
        is_read: true,
      })
      .eq(
        'user_id',
        userId,
      )
      .eq(
        'is_read',
        false,
      );

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    return {
      success: true,
      message:
        'All notifications marked as read.',
    };
  }

  // ============================================================
  // DELETE NOTIFICATION
  // ============================================================

  async deleteNotification(
    userId: string,
    notificationId: string,
  ) {
    const {
      data,
      error,
    } = await supabase
      .from('notifications')
      .delete()
      .eq(
        'id',
        notificationId,
      )
      .eq(
        'user_id',
        userId,
      )
      .select('id')
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    if (!data) {
      throw new NotFoundException(
        'Notification not found.',
      );
    }

    return {
      success: true,
      message:
        'Notification deleted.',
    };
  }
}