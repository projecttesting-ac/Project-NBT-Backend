
import {
  Controller,
  Delete,
  Get,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { BlocksService } from './blocks.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProfileCompletedGuard } from '../auth/profile-completed.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('blocks')
@UseGuards(JwtAuthGuard, ProfileCompletedGuard)
export class BlocksController {
  constructor(
    private readonly blocksService: BlocksService,
  ) {}

  // Block another user
  @Post()
  blockUser(
    @CurrentUser() user: any,
    @Query('userId', new ParseUUIDPipe()) userId: string,
  ) {
    return this.blocksService.blockUser(
      user.id,
      userId,
    );
  }

  // Remove a user from the blocked list
  @Delete()
  unblockUser(
    @CurrentUser() user: any,
    @Query('userId', new ParseUUIDPipe()) userId: string,
  ) {
    return this.blocksService.unblockUser(
      user.id,
      userId,
    );
  }

  // Get users blocked by the current user
  @Get()
  getBlockedUsers(
    @CurrentUser() user: any,
    @Query() pagination: PaginationDto,
  ) {
    return this.blocksService.getBlockedUsers(
      user.id,
      pagination,
    );
  }

  // Check whether a user is blocked
  @Get('status')
  getBlockStatus(
    @CurrentUser() user: any,
    @Query('userId', new ParseUUIDPipe()) userId: string,
  ) {
    return this.blocksService.getBlockStatus(
      user.id,
      userId,
    );
  }
}
