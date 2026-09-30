import { Module } from '@nestjs/common';

import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventReminderService } from './event-reminder.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    NotificationsModule,
  ],
  controllers: [
    EventsController,
  ],
  providers: [
    EventsService,
    EventReminderService,
  ],
})
export class EventsModule {}