import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';

import { FriendsService } from './friends.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('friends')
export class FriendsController {
  constructor(
    private readonly friendsService: FriendsService,
  ) {}

  @UseGuards(JwtAuthGuard)
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

  @UseGuards(JwtAuthGuard)
  @Get('requests')
  getReceivedRequests(
    @CurrentUser() user: any,
  ) {
    return this.friendsService.getReceivedRequests(
      user.id,
    );
  }
}