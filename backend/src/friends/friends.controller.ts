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

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { FriendsService } from './friends.service';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(
    private readonly friendsService: FriendsService,
  ) {}

  @Post('request')
  @Throttle({
    default: {
      limit: 20,
      ttl: 60 * 1000,
    },
  })
  sendFriendRequest(
    @CurrentUser() user: any,
    @Body('receiverId') receiverId: string,
  ) {
    return this.friendsService.sendFriendRequest(
      user.id,
      receiverId,
    );
  }

  @Get('requests')
  getReceivedRequests(
    @CurrentUser() user: any,
  ) {
    return this.friendsService.getReceivedRequests(
      user.id,
    );
  }

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

  @Get('requests/sent')
  getSentRequests(
    @CurrentUser() user: any,
  ) {
    return this.friendsService.getSentRequests(
      user.id,
    );
  }

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

  @Get()
  getFriends(
    @CurrentUser() user: any,
  ) {
    return this.friendsService.getFriends(
      user.id,
    );
  }

  @Get('search')
  @Throttle({
    default: {
      limit: 60,
      ttl: 60 * 1000,
    },
  })
  searchUsers(
    @CurrentUser() user: any,
    @Query('q') search: string,
  ) {
    return this.friendsService.searchUsers(
      user.id,
      search,
    );
  }

  @Get('suggestions')
  @Throttle({
    default: {
      limit: 60,
      ttl: 60 * 1000,
    },
  })
  getSuggestions(
    @CurrentUser() user: any,
  ) {
    return this.friendsService.getSuggestions(
      user.id,
    );
  }

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