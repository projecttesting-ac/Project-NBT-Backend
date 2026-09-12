import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

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

  @Get('unread-count')
  getUnreadCount(
    @CurrentUser() user: any,
  ) {
    return this.notificationsService.getUnreadCount(
      user.id,
    );
  }

  @Patch('read-all')
  markAllAsRead(
    @CurrentUser() user: any,
  ) {
    return this.notificationsService.markAllAsRead(
      user.id,
    );
  }

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