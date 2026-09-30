import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';

import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
@Throttle({
  default: {
    limit: 60,
    ttl: 60 * 1000,
  },
})
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  // ============================================================
  // GET MY NOTIFICATIONS
  // ============================================================
  //
  // Examples:
  //
  // GET /api/notifications
  // GET /api/notifications?page=1&limit=20
  // GET /api/notifications?category=connections
  // GET /api/notifications?category=clubs
  //
  // The category parameter is optional.
  // ============================================================

  @Get()
  getMyNotifications(
    @CurrentUser() user: any,

    @Query('page')
    page?: string,

    @Query('limit')
    limit?: string,

    @Query('category')
    category?: string,
  ) {
    return this.notificationsService.getMyNotifications(
      user.id,
      Number(page) || 1,
      Number(limit) || 20,
      category || 'all',
    );
  }

  // ============================================================
  // GET UNREAD COUNT
  // ============================================================
  //
  // Used for the notification badge in the app.
  //
  // Example:
  //
  // GET /api/notifications/unread-count
  // ============================================================

  @Get('unread-count')
  getUnreadCount(
    @CurrentUser() user: any,
  ) {
    return this.notificationsService.getUnreadCount(
      user.id,
    );
  }

  // ============================================================
  // GET NOTIFICATION PREFERENCES
  // ============================================================

  @Get('preferences')
  getNotificationPreferences(
    @CurrentUser() user: any,
  ) {
    return this.notificationsService.getNotificationPreferences(
      user.id,
    );
  }

  // ============================================================
  // UPDATE NOTIFICATION PREFERENCES
  // ============================================================
  //
  // The frontend can send only the fields it wants to change.
  //
  // Example:
  //
  // {
  //   "clubNotifications": false,
  //   "eventNotifications": true
  // }
  // ============================================================

  @Patch('preferences')
  updateNotificationPreferences(
    @CurrentUser() user: any,

    @Body()
    dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.updateNotificationPreferences(
      user.id,
      dto,
    );
  }

  // ============================================================
  // MARK ALL AS READ
  // ============================================================

  @Patch('read-all')
  markAllAsRead(
    @CurrentUser() user: any,
  ) {
    return this.notificationsService.markAllAsRead(
      user.id,
    );
  }

  // ============================================================
  // MARK ONE NOTIFICATION AS READ
  // ============================================================

  @Patch(':notificationId/read')
  markAsRead(
    @CurrentUser() user: any,

    @Param('notificationId')
    notificationId: string,
  ) {
    return this.notificationsService.markAsRead(
      user.id,
      notificationId,
    );
  }

  // ============================================================
  // CLEAR ALL NOTIFICATIONS
  // ============================================================
  //
  // This is used by the "Clear" action on the notification page.
  // ============================================================

  @Delete('clear-all')
  clearAllNotifications(
    @CurrentUser() user: any,
  ) {
    return this.notificationsService.clearAllNotifications(
      user.id,
    );
  }

  // ============================================================
  // DELETE ONE NOTIFICATION
  // ============================================================

  @Delete(':notificationId')
  deleteNotification(
    @CurrentUser() user: any,

    @Param('notificationId')
    notificationId: string,
  ) {
    return this.notificationsService.deleteNotification(
      user.id,
      notificationId,
    );
  }
}