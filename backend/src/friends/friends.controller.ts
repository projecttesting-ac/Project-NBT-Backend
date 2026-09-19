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
    // send a new friend request
    return this.friendsService.sendFriendRequest(
      user.id,
      receiverId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('requests')
  getReceivedRequests(
    @CurrentUser() user: any,
  ) {
    // get incoming friend requests
    return this.friendsService.getReceivedRequests(
      user.id,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('requests/:requestId/accept')
  acceptFriendRequest(
    @CurrentUser() user: any,
    @Param('requestId') requestId: string,
  ) {
    // accept a friend request
    return this.friendsService.acceptFriendRequest(
      user.id,
      requestId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('requests/:requestId/decline')
  declineFriendRequest(
    @CurrentUser() user: any,
    @Param('requestId') requestId: string,
  ) {
    // decline a friend request
    return this.friendsService.declineFriendRequest(
      user.id,
      requestId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('requests/sent')
  getSentRequests(
    @CurrentUser() user: any,
  ) {
    // get requests sent by the user
    return this.friendsService.getSentRequests(
      user.id,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('requests/:requestId')
  cancelFriendRequest(
    @CurrentUser() user: any,
    @Param('requestId') requestId: string,
  ) {
    // cancel a sent request
    return this.friendsService.cancelFriendRequest(
      user.id,
      requestId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  getFriends(
    @CurrentUser() user: any,
  ) {
    // get the user's friends
    return this.friendsService.getFriends(
      user.id,
    );
  }

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
    // search for users
    return this.friendsService.searchUsers(
      user.id,
      search,
    );
  }

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
    // get people the user may know
    return this.friendsService.getSuggestions(
      user.id,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('status/:userId')
  getFriendStatus(
    @CurrentUser() user: any,
    @Param('userId') otherUserId: string,
  ) {
    // check the friendship status
    return this.friendsService.getFriendStatus(
      user.id,
      otherUserId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':friendId')
  removeFriend(
    @CurrentUser() user: any,
    @Param('friendId') friendId: string,
  ) {
    // remove an existing friend
    return this.friendsService.removeFriend(
      user.id,
      friendId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('mutual/:userId')
  getMutualFriends(
    @CurrentUser() user: any,
    @Param('userId') otherUserId: string,
  ) {
    // get friends shared with another user
    return this.friendsService.getMutualFriends(
      user.id,
      otherUserId,
    );
  }
}