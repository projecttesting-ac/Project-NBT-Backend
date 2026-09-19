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
import { CurrentUser } from '../auth/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('blocks')
@UseGuards(JwtAuthGuard)
export class BlocksController {
  constructor(
    private readonly blocksService: BlocksService,
  ) {}

  // block another user
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

  // remove a user from the blocked list
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

  // get users blocked by the current user
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

  // check whether a user is blocked
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