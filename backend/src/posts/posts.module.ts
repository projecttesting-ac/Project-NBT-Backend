import { Module } from '@nestjs/common';

import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    NotificationsModule,
  ],

  controllers: [
    PostsController,
    CommentsController,
  ],

  providers: [
    PostsService,
    CommentsService,
  ],
})
export class PostsModule {}