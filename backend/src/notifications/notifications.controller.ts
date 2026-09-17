import {
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

  // =========================================================
  // GET MY NOTIFICATIONS
  // 60 requests / 1 minute
  // =========================================================

  @Get()
  getMyNotifications(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.getMyNotifications(
      user.id,
      Number(page) || 1,
      Number(limit) || 20,
    );
  }

  // =========================================================
  // GET UNREAD COUNT
  // 60 requests / 1 minute
  // =========================================================

  @Get('unread-count')
  getUnreadCount(
    @CurrentUser() user: any,
  ) {
    return this.notificationsService.getUnreadCount(
      user.id,
    );
  }

  // =========================================================
  // MARK ALL AS READ
  // 60 requests / 1 minute
  // =========================================================

  @Patch('read-all')
  markAllAsRead(
    @CurrentUser() user: any,
  ) {
    return this.notificationsService.markAllAsRead(
      user.id,
    );
  }

  // =========================================================
  // MARK NOTIFICATION AS READ
  // 60 requests / 1 minute
  // =========================================================

  @Patch(':notificationId/read')
  markAsRead(
    @CurrentUser() user: any,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationsService.markAsRead(
      user.id,
      notificationId,
    );
  }

  // =========================================================
  // DELETE NOTIFICATION
  // 60 requests / 1 minute
  // =========================================================

  @Delete(':notificationId')
  deleteNotification(
    @CurrentUser() user: any,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationsService.deleteNotification(
      user.id,
      notificationId,
    );
  }
}