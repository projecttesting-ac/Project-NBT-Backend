import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsModule } from './notifications/notifications.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MediaModule } from './media/media.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EventsModule } from './events/events.module';
import { ConversationsModule } from './conversations/conversations.module';
import { ClubsModule } from './clubs/clubs.module';
import { FriendsModule } from './friends/friends.module';
import { PostsModule } from './posts/posts.module';
import { BlocksModule } from './blocks/blocks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    MediaModule,
    AuthModule,
    UsersModule,
    EventsModule,
    ConversationsModule,
    ClubsModule,
    FriendsModule,
    PostsModule,
    BlocksModule,
    NotificationsModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}