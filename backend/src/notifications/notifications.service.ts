import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import { supabase } from '../config/supabase';

import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

type NotificationCategory =
  | 'connections'
  | 'posts'
  | 'comments'
  | 'clubs'
  | 'events'
  | 'matches'
  | 'system';

type NotificationCategoryFilter =
  | NotificationCategory
  | 'all';

@Injectable()
export class NotificationsService {
  // ============================================================
  // CREATE NOTIFICATION
  // ============================================================
  //
  // This is the main method used by other modules when they
  // need to create a notification.
  //
  // Examples:
  //
  // Friend request
  // Comment
  // Reply
  // Club role change
  // Post mention
  //
  // Notification failures can be handled safely by using
  // tryCreateNotification() instead.
  // ============================================================

  async createNotification(
    userId: string,
    type: string,
    title: string,
    message?: string,
    actorId?: string,
    entityId?: string,
    entityType?: string,
  ) {
    // A user should never receive a notification for
    // their own action.
    if (
      actorId &&
      actorId === userId
    ) {
      return null;
    }

    // Check whether this type of notification is enabled
    // in the user's notification preferences.
    const allowed =
      await this.isNotificationAllowed(
        userId,
        type,
      );

    if (!allowed) {
      return null;
    }

    const {
      data,
      error,
    } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        actor_id:
          actorId ?? null,
        type,
        title,
        message:
          message ?? null,
        entity_id:
          entityId ?? null,
        entity_type:
          entityType ?? null,
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
  //
  // A notification should never break the main action.
  //
  // For example:
  //
  // If a friend request is successfully created but the
  // notification insert fails, the friend request should
  // still remain successful.
  // ============================================================

  async tryCreateNotification(
    userId: string,
    type: string,
    title: string,
    message?: string,
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

      // Do not throw the error again.
      // The main user action should continue normally.
      return null;
    }
  }

  // ============================================================
  // NOTIFY MENTIONED USERS
  // ============================================================
  //
  // Mentions are supported for:
  //
  // - Posts
  // - Comments
  //
  // Chat mentions are intentionally NOT handled here.
  //
  // Chat mentions are stored separately in message_mentions
  // by ConversationsService.
  // ============================================================

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

    // Find all @username mentions.
    //
    // Example:
    //
    // "Hello @john and @alex"
    //
    // becomes:
    //
    // ["@john", "@alex"]
    const mentionMatches =
      content.match(
        /@[a-zA-Z0-9_]+/g,
      ) ?? [];

    if (
      mentionMatches.length === 0
    ) {
      return [];
    }

    // Remove the @ symbol and normalize the usernames.
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

    if (
      usernames.length === 0
    ) {
      return [];
    }

    // Find all users mentioned in the content.
    const {
      data: users,
      error: usersError,
    } = await supabase
      .from('users')
      .select(
        'id, username',
      )
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

    // Posts and comments use different notification types.
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

    for (const user of users) {
      // Don't create a notification when a user mentions
      // themselves.
      if (
        user.id === actorId
      ) {
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
  //
  // Supports:
  //
  // GET /notifications
  //
  // GET /notifications?category=connections
  //
  // GET /notifications?category=posts
  //
  // GET /notifications?category=comments
  //
  // GET /notifications?category=clubs
  //
  // GET /notifications?category=events
  //
  // GET /notifications?category=matches
  //
  // GET /notifications?category=system
  // ============================================================

  async getMyNotifications(
    userId: string,
    page = 1,
    limit = 20,
    category: string = 'all',
  ) {
    // Keep pagination values within safe limits.
    const safePage =
      Math.max(
        1,
        Number(page) || 1,
      );

    const safeLimit =
      Math.min(
        50,
        Math.max(
          1,
          Number(limit) || 20,
        ),
      );

    const normalizedCategory =
      this.normalizeCategory(
        category,
      );

    const from =
      (safePage - 1) *
      safeLimit;

    const to =
      from + safeLimit - 1;

    let query =
      supabase
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
        );

    // If the frontend selected a category,
    // only return notifications belonging to that category.
    if (
      normalizedCategory !==
      'all'
    ) {
      const types =
        this.getTypesForCategory(
          normalizedCategory,
        );

      if (
        types.length === 0
      ) {
        return {
          success: true,
          notifications: [],
          pagination: {
            page: safePage,
            limit: safeLimit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage:
              safePage > 1,
          },
        };
      }

      query = query.in(
        'type',
        types,
      );
    }

    const {
      data,
      error,
      count,
    } = await query.range(
      from,
      to,
    );

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    const notifications =
      data ?? [];

    // ==========================================================
    // GET ACTOR PROFILES
    // ==========================================================
    //
    // Notifications store actor_id.
    // The frontend also needs information such as:
    //
    // username
    // display name
    // avatar
    //
    // So we load the actors in one query instead of querying
    // the users table once for every notification.
    // ==========================================================

    const actorIds = [
      ...new Set(
        notifications
          .map(
            (notification) =>
              notification.actor_id,
          )
          .filter(Boolean),
      ),
    ];

    let actors: any[] = [];

    if (
      actorIds.length > 0
    ) {
      const {
        data: actorData,
        error: actorError,
      } = await supabase
        .from('users')
        .select(
          `
          id,
          username,
          display_name,
          avatar_url
          `,
        )
        .in(
          'id',
          actorIds,
        );

      if (actorError) {
        throw new BadRequestException(
          actorError.message,
        );
      }

      actors =
        actorData ?? [];
    }

    // Create a quick lookup map.
    const actorMap =
      new Map<
        string,
        any
      >();

    for (const actor of actors) {
      actorMap.set(
        actor.id,
        actor,
      );
    }

    // ==========================================================
    // FORMAT NOTIFICATIONS
    // ==========================================================

    const formattedNotifications =
      notifications.map(
        (notification) => {
          const actor =
            notification.actor_id
              ? actorMap.get(
                  notification.actor_id,
                )
              : null;

          return {
            id:
              notification.id,

            userId:
              notification.user_id,

            actorId:
              notification.actor_id,

            actor: actor
              ? {
                  id:
                    actor.id,

                  username:
                    actor.username,

                  displayName:
                    actor.display_name,

                  avatarUrl:
                    actor.avatar_url,
                }
              : null,

            type:
              notification.type,

            category:
              this.getCategoryForType(
                notification.type,
              ),

            title:
              notification.title,

            message:
              notification.message,

            entityId:
              notification.entity_id,

            entityType:
              notification.entity_type,

            isRead:
              notification.is_read,

            createdAt:
              notification.created_at,
          };
        },
      );

    const total =
      count ?? 0;

    const totalPages =
      total > 0
        ? Math.ceil(
            total /
              safeLimit,
          )
        : 0;

    return {
      success: true,

      notifications:
        formattedNotifications,

      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,

        hasNextPage:
          safePage <
          totalPages,

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
    // The user_id condition is important.
    // It prevents one user from modifying another user's
    // notification.
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
      .select()
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    if (!data) {
      throw new BadRequestException(
        'Notification not found.',
      );
    }

    return {
      success: true,
      message:
        'Notification marked as read.',
      notification:
        data,
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
  // DELETE ONE NOTIFICATION
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
      .select()
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    if (!data) {
      throw new BadRequestException(
        'Notification not found.',
      );
    }

    return {
      success: true,
      message:
        'Notification deleted successfully.',
    };
  }

  // ============================================================
  // CLEAR ALL NOTIFICATIONS
  // ============================================================

  async clearAllNotifications(
    userId: string,
  ) {
    // Delete only the logged-in user's notifications.
    const {
      error,
    } = await supabase
      .from('notifications')
      .delete()
      .eq(
        'user_id',
        userId,
      );

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    return {
      success: true,
      message:
        'All notifications cleared successfully.',
    };
  }

  // ============================================================
  // GET NOTIFICATION PREFERENCES
  // ============================================================

  async getNotificationPreferences(
    userId: string,
  ) {
    const {
      data,
      error,
    } = await supabase
      .from(
        'notification_preferences',
      )
      .select('*')
      .eq(
        'user_id',
        userId,
      )
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    // If the user has never saved preferences,
    // create the default settings.
    if (!data) {
      const {
        data: created,
        error: createError,
      } = await supabase
        .from(
          'notification_preferences',
        )
        .insert({
          user_id:
            userId,

          push_enabled:
            true,

          connection_notifications:
            true,

          post_notifications:
            true,

          comment_notifications:
            true,

          club_notifications:
            true,

          event_notifications:
            true,

          match_notifications:
            true,

          quiet_hours_enabled:
            false,

          quiet_hours_start:
            null,

          quiet_hours_end:
            null,
        })
        .select()
        .single();

      if (createError) {
        throw new BadRequestException(
          createError.message,
        );
      }

      return {
        success: true,
        preferences:
          this.formatPreferences(
            created,
          ),
      };
    }

    return {
      success: true,
      preferences:
        this.formatPreferences(
          data,
        ),
    };
  }

  // ============================================================
  // UPDATE NOTIFICATION PREFERENCES
  // ============================================================

  async updateNotificationPreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ) {
    const updates: Record<
      string,
      any
    > = {};

    // Convert frontend camelCase fields into the snake_case
    // column names used in Supabase.
    if (
      dto.pushEnabled !==
      undefined
    ) {
      updates.push_enabled =
        dto.pushEnabled;
    }

    if (
      dto.connectionNotifications !==
      undefined
    ) {
      updates.connection_notifications =
        dto.connectionNotifications;
    }

    if (
      dto.postNotifications !==
      undefined
    ) {
      updates.post_notifications =
        dto.postNotifications;
    }

    if (
      dto.commentNotifications !==
      undefined
    ) {
      updates.comment_notifications =
        dto.commentNotifications;
    }

    if (
      dto.clubNotifications !==
      undefined
    ) {
      updates.club_notifications =
        dto.clubNotifications;
    }

    if (
      dto.eventNotifications !==
      undefined
    ) {
      updates.event_notifications =
        dto.eventNotifications;
    }

    if (
      dto.matchNotifications !==
      undefined
    ) {
      updates.match_notifications =
        dto.matchNotifications;
    }

    if (
      dto.quietHoursEnabled !==
      undefined
    ) {
      updates.quiet_hours_enabled =
        dto.quietHoursEnabled;
    }

    if (
      dto.quietHoursStart !==
      undefined
    ) {
      updates.quiet_hours_start =
        dto.quietHoursStart;
    }

    if (
      dto.quietHoursEnd !==
      undefined
    ) {
      updates.quiet_hours_end =
        dto.quietHoursEnd;
    }

    updates.updated_at =
      new Date().toISOString();

    // First check whether the user already has a preference row.
    const {
      data: existing,
      error: existingError,
    } = await supabase
      .from(
        'notification_preferences',
      )
      .select('id')
      .eq(
        'user_id',
        userId,
      )
      .maybeSingle();

    if (existingError) {
      throw new BadRequestException(
        existingError.message,
      );
    }

    let data: any;

    if (existing) {
      // Update the existing preference row.
      const {
        data: updated,
        error: updateError,
      } = await supabase
        .from(
          'notification_preferences',
        )
        .update(updates)
        .eq(
          'user_id',
          userId,
        )
        .select()
        .single();

      if (updateError) {
        throw new BadRequestException(
          updateError.message,
        );
      }

      data = updated;
    } else {
      // If this is the first update, create the complete row.
      const {
        data: created,
        error: createError,
      } = await supabase
        .from(
          'notification_preferences',
        )
        .insert({
          user_id:
            userId,

          push_enabled:
            dto.pushEnabled ??
            true,

          connection_notifications:
            dto.connectionNotifications ??
            true,

          post_notifications:
            dto.postNotifications ??
            true,

          comment_notifications:
            dto.commentNotifications ??
            true,

          club_notifications:
            dto.clubNotifications ??
            true,

          event_notifications:
            dto.eventNotifications ??
            true,

          match_notifications:
            dto.matchNotifications ??
            true,

          quiet_hours_enabled:
            dto.quietHoursEnabled ??
            false,

          quiet_hours_start:
            dto.quietHoursStart ??
            null,

          quiet_hours_end:
            dto.quietHoursEnd ??
            null,
        })
        .select()
        .single();

      if (createError) {
        throw new BadRequestException(
          createError.message,
        );
      }

      data = created;
    }

    return {
      success: true,
      message:
        'Notification preferences updated successfully.',
      preferences:
        this.formatPreferences(
          data,
        ),
    };
  }

  // ============================================================
  // CHECK WHETHER A NOTIFICATION IS ALLOWED
  // ============================================================
  //
  // Important:
  //
  // pushEnabled and quiet hours are NOT used to delete or hide
  // in-app notifications.
  //
  // They are stored for the future push-notification system.
  //
  // The category switches below control whether the actual
  // notification record is created.
  // ============================================================

  private async isNotificationAllowed(
    userId: string,
    type: string,
  ): Promise<boolean> {
    const {
      data,
      error,
    } = await supabase
      .from(
        'notification_preferences',
      )
      .select(
        `
        connection_notifications,
        post_notifications,
        comment_notifications,
        club_notifications,
        event_notifications,
        match_notifications
        `,
      )
      .eq(
        'user_id',
        userId,
      )
      .maybeSingle();

    // If preferences don't exist, use the default:
    // everything is enabled.
    if (error || !data) {
      return true;
    }

    const category =
      this.getCategoryForType(
        type,
      );

    switch (category) {
      case 'connections':
        return (
          data.connection_notifications ??
          true
        );

      case 'posts':
        return (
          data.post_notifications ??
          true
        );

      case 'comments':
        return (
          data.comment_notifications ??
          true
        );

      case 'clubs':
        return (
          data.club_notifications ??
          true
        );

      case 'events':
        return (
          data.event_notifications ??
          true
        );

      case 'matches':
        return (
          data.match_notifications ??
          true
        );

      // System notifications should always be allowed.
      case 'system':
      default:
        return true;
    }
  }

  // ============================================================
  // NORMALIZE CATEGORY
  // ============================================================

  private normalizeCategory(
    category?: string,
  ): NotificationCategoryFilter {
    const normalized =
      String(
        category ?? 'all',
      )
        .trim()
        .toLowerCase();

    const allowed:
      NotificationCategoryFilter[] =
      [
        'all',
        'connections',
        'posts',
        'comments',
        'clubs',
        'events',
        'matches',
        'system',
      ];

    if (
      !allowed.includes(
        normalized as NotificationCategoryFilter,
      )
    ) {
      throw new BadRequestException(
        `Invalid notification category. Allowed categories: ${allowed.join(', ')}.`,
      );
    }

    return normalized as NotificationCategoryFilter;
  }

  // ============================================================
  // GET NOTIFICATION TYPES FOR A CATEGORY
  // ============================================================

  private getTypesForCategory(
    category:
      NotificationCategory,
  ): string[] {
    switch (category) {
      case 'connections':
        return [
          'FRIEND_REQUEST',
          'FRIEND_REQUEST_ACCEPTED',
          'NEW_MATCH',
        ];

      case 'posts':
        return [
          'MENTION_POST',
          'POST_LIKE',
          'POST_COMMENT',
        ];

      case 'comments':
        return [
          'MENTION_COMMENT',
          'COMMENT_REPLY',
        ];

      case 'clubs':
        return [
          'CLUB_JOIN',
          'CLUB_REMOVED',
          'CLUB_ROLE_CHANGED',
          'CLUB_ANNOUNCEMENT',
          'CLUB_DISCUSSION',
          'CAMPUS_PULSE',
        ];

      case 'events':
        return [
          'EVENT_CREATED',
          'EVENT_UPDATE',
          'EVENT_REMINDER',
          'RSVP_CONFIRMED',
        ];

      case 'matches':
        return [
          'NEW_MATCH',
        ];

      case 'system':
        return [
          'SYSTEM',
        ];

      default:
        return [];
    }
  }

  // ============================================================
  // GET CATEGORY FOR NOTIFICATION TYPE
  // ============================================================

  private getCategoryForType(
    type: string,
  ): NotificationCategory {
    switch (type) {
      case 'FRIEND_REQUEST':
      case 'FRIEND_REQUEST_ACCEPTED':
        return 'connections';

      case 'MENTION_POST':
      case 'POST_LIKE':
      case 'POST_COMMENT':
        return 'posts';

      case 'MENTION_COMMENT':
      case 'COMMENT_REPLY':
        return 'comments';

      case 'CLUB_JOIN':
      case 'CLUB_REMOVED':
      case 'CLUB_ROLE_CHANGED':
      case 'CLUB_ANNOUNCEMENT':
      case 'CLUB_DISCUSSION':
      case 'CAMPUS_PULSE':
        return 'clubs';

      case 'EVENT_CREATED':
      case 'EVENT_UPDATE':
      case 'EVENT_REMINDER':
      case 'RSVP_CONFIRMED':
        return 'events';

      case 'NEW_MATCH':
        return 'matches';

      default:
        return 'system';
    }
  }

  // ============================================================
  // FORMAT PREFERENCES FOR API RESPONSE
  // ============================================================
  //
  // Database uses snake_case.
  // API response uses camelCase so the Flutter developer
  // doesn't have to deal with database column naming.
  // ============================================================

  private formatPreferences(
    data: any,
  ) {
    return {
      id: data.id,

      userId:
        data.user_id,

      pushEnabled:
        data.push_enabled,

      connectionNotifications:
        data.connection_notifications,

      postNotifications:
        data.post_notifications,

      commentNotifications:
        data.comment_notifications,

      clubNotifications:
        data.club_notifications,

      eventNotifications:
        data.event_notifications,

      matchNotifications:
        data.match_notifications,

      quietHoursEnabled:
        data.quiet_hours_enabled,

      quietHoursStart:
        data.quiet_hours_start,

      quietHoursEnd:
        data.quiet_hours_end,

      createdAt:
        data.created_at,

      updatedAt:
        data.updated_at,
    };
  }
}