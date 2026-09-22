import { Module } from '@nestjs/common';

import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [MediaModule , NotificationsModule,],
  controllers: [ConversationsController],
  providers: [ConversationsService],
})
export class ConversationsModule {}