import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  ThrottlerGuard,
  ThrottlerModule,
} from '@nestjs/throttler';

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

    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60_000,
          limit: 100,

          getTracker: async (req) => {
            // If authentication has already populated req.user.
            if (req.user?.id) {
              return `user:${req.user.id}`;
            }

            // Otherwise fall back to IP.
            const forwardedFor =
              req.headers?.['x-forwarded-for'];

            if (
              typeof forwardedFor === 'string' &&
              forwardedFor.length > 0
            ) {
              return `ip:${forwardedFor
                .split(',')[0]
                .trim()}`;
            }

            if (
              Array.isArray(forwardedFor) &&
              forwardedFor.length > 0
            ) {
              return `ip:${String(forwardedFor[0])}`;
            }

            return `ip:${
              req.ip ||
              req.socket?.remoteAddress ||
              'unknown'
            }`;
          },
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

  controllers: [AppController],

  providers: [
    AppService,

    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    JwtService,
  ],
})
export class AppModule {}