import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';

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

import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',

          // Global fallback:
          // 100 requests / 1 minute
          ttl: 60_000,
          limit: 100,
        },
      ],
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

  controllers: [
    AppController,
  ],

  providers: [
    AppService,

    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },

    JwtService,
  ],
})
export class AppModule {}