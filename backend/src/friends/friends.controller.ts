import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { FriendsService } from './friends.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('friends')
export class FriendsController {
  constructor(
    private readonly friendsService: FriendsService,
  ) {}

  // =========================================================
  // SEND FRIEND REQUEST
  // 20 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 20,
      ttl: 60 * 1000,
    },
  })
  @Post('request')
  sendFriendRequest(
    @CurrentUser() user: any,
    @Body('receiverId') receiverId: string,
  ) {
    return this.friendsService.sendFriendRequest(
      user.id,
      receiverId,
    );
  }

  // =========================================================
  // RECEIVED REQUESTS
  // Global fallback: 100 / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Get('requests')
  getReceivedRequests(
    @CurrentUser() user: any,
  ) {
    return this.friendsService.getReceivedRequests(
      user.id,
    );
  }

  // =========================================================
  // ACCEPT REQUEST
  // Global fallback: 100 / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Patch('requests/:requestId/accept')
  acceptFriendRequest(
    @CurrentUser() user: any,
    @Param('requestId') requestId: string,
  ) {
    return this.friendsService.acceptFriendRequest(
      user.id,
      requestId,
    );
  }

  // =========================================================
  // DECLINE REQUEST
  // Global fallback: 100 / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Patch('requests/:requestId/decline')
  declineFriendRequest(
    @CurrentUser() user: any,
    @Param('requestId') requestId: string,
  ) {
    return this.friendsService.declineFriendRequest(
      user.id,
      requestId,
    );
  }

  // =========================================================
  // SENT REQUESTS
  // Global fallback: 100 / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Get('requests/sent')
  getSentRequests(
    @CurrentUser() user: any,
  ) {
    return this.friendsService.getSentRequests(
      user.id,
    );
  }

  // =========================================================
  // CANCEL REQUEST
  // Global fallback: 100 / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Delete('requests/:requestId')
  cancelFriendRequest(
    @CurrentUser() user: any,
    @Param('requestId') requestId: string,
  ) {
    return this.friendsService.cancelFriendRequest(
      user.id,
      requestId,
    );
  }

  // =========================================================
  // GET FRIENDS
  // Global fallback: 100 / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Get()
  getFriends(
    @CurrentUser() user: any,
  ) {
    return this.friendsService.getFriends(
      user.id,
    );
  }

  // =========================================================
  // SEARCH USERS
  // 60 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 60,
      ttl: 60 * 1000,
    },
  })
  @Get('search')
  searchUsers(
    @CurrentUser() user: any,
    @Query('q') search: string,
  ) {
    return this.friendsService.searchUsers(
      user.id,
      search,
    );
  }

  // =========================================================
  // FRIEND SUGGESTIONS
  // 60 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 60,
      ttl: 60 * 1000,
    },
  })
  @Get('suggestions')
  getSuggestions(
    @CurrentUser() user: any,
  ) {
    return this.friendsService.getSuggestions(
      user.id,
    );
  }

  // =========================================================
  // FRIEND STATUS
  // Global fallback: 100 / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Get('status/:userId')
  getFriendStatus(
    @CurrentUser() user: any,
    @Param('userId') otherUserId: string,
  ) {
    return this.friendsService.getFriendStatus(
      user.id,
      otherUserId,
    );
  }

  // =========================================================
  // REMOVE FRIEND
  // Global fallback: 100 / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Delete(':friendId')
  removeFriend(
    @CurrentUser() user: any,
    @Param('friendId') friendId: string,
  ) {
    return this.friendsService.removeFriend(
      user.id,
      friendId,
    );
  }

  // =========================================================
  // MUTUAL FRIENDS
  // Global fallback: 100 / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Get('mutual/:userId')
  getMutualFriends(
    @CurrentUser() user: any,
    @Param('userId') otherUserId: string,
  ) {
    return this.friendsService.getMutualFriends(
      user.id,
      otherUserId,
    );
  }
}