import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class UpdateNotificationPreferencesDto {
  // Enable or disable push notifications.
  //
  // This is stored now so that a push notification
  // system can use it later.
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  // Friend requests and other connection-related notifications.
  @IsOptional()
  @IsBoolean()
  connectionNotifications?: boolean;

  // Notifications related to posts.
  @IsOptional()
  @IsBoolean()
  postNotifications?: boolean;

  // Notifications related to comments and replies.
  @IsOptional()
  @IsBoolean()
  commentNotifications?: boolean;

  // Notifications related to clubs.
  @IsOptional()
  @IsBoolean()
  clubNotifications?: boolean;

  // Notifications related to events.
  @IsOptional()
  @IsBoolean()
  eventNotifications?: boolean;

  // Notifications related to matches.
  @IsOptional()
  @IsBoolean()
  matchNotifications?: boolean;

  // Enable or disable quiet hours.
  @IsOptional()
  @IsBoolean()
  quietHoursEnabled?: boolean;

  // Quiet-hours starting time.
  //
  // Example:
  // 22:00
  @IsOptional()
  @IsString()
  @Matches(
    /^([01]\d|2[0-3]):[0-5]\d$/,
    {
      message:
        'quietHoursStart must use HH:MM format.',
    },
  )
  quietHoursStart?: string;

  // Quiet-hours ending time.
  //
  // Example:
  // 07:00
  @IsOptional()
  @IsString()
  @Matches(
    /^([01]\d|2[0-3]):[0-5]\d$/,
    {
      message:
        'quietHoursEnd must use HH:MM format.',
    },
  )
  quietHoursEnd?: string;
}