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

  // =========================================================
  // BLOCK USER
  // POST /api/blocks?userId=USER_UUID
  // =========================================================

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

  // =========================================================
  // UNBLOCK USER
  // DELETE /api/blocks?userId=USER_UUID
  // =========================================================

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

  // =========================================================
  // GET MY BLOCKED USERS
  // GET /api/blocks
  // =========================================================

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

  // =========================================================
  // CHECK BLOCK STATUS
  // GET /api/blocks/status?userId=USER_UUID
  // =========================================================

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