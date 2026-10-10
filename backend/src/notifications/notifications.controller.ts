
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
import { ProfileCompletedGuard } from '../auth/profile-completed.guard';
import { CurrentUser } from '../auth/current-user.decorator';

import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, ProfileCompletedGuard)
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

  @Get()
  getMyNotifications(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
  ) {
    return this.notificationsService.getMyNotifications(
      user.id,
      Number(page) || 1,
      Number(limit) || 20,
      category || 'all',
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

  @Get('preferences')
  getNotificationPreferences(
    @CurrentUser() user: any,
  ) {
    return this.notificationsService.getNotificationPreferences(
      user.id,
    );
  }

  @Patch('preferences')
  updateNotificationPreferences(
    @CurrentUser() user: any,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.updateNotificationPreferences(
      user.id,
      dto,
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

  @Delete('clear-all')
  clearAllNotifications(
    @CurrentUser() user: any,
  ) {
    return this.notificationsService.clearAllNotifications(
      user.id,
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
