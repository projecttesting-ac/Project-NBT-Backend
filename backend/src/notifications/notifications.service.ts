import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { supabase } from '../config/supabase';

@Injectable()
export class NotificationsService {
  async createNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    actorId?: string,
    entityId?: string,
    entityType?: string,
  ) {
    // don't notify users about their own actions
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
      // notification errors shouldn't break the main action
      console.error(
        'Notification creation failed:',
        error instanceof Error
          ? error.message
          : error,
      );

      return null;
    }
  }

  async notifyMentionedUsers(
    content: string,
    actorId: string,
    entityId: string,
    entityType:
      | 'POST'
      | 'COMMENT',
  ) {
    if (
      !content ||
      !content.trim()
    ) {
      return [];
    }

    // find usernames mentioned with @
    const mentionMatches =
      content.match(
        /@[a-zA-Z0-9_]+/g,
      ) ?? [];

    if (
      mentionMatches.length === 0
    ) {
      return [];
    }

    // normalize usernames before searching
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

    // find the mentioned users
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

    if (
      !users ||
      users.length === 0
    ) {
      return [];
    }

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

    const notifications: any[] =
      [];

    // create a notification for each mentioned user
    for (const user of users) {
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