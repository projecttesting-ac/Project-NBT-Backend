import {
  Controller,
  Delete,
  Get,
  Param,
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
  // POST /api/blocks/:userId
  // =========================================================

  @Post(':userId')
  blockUser(
    @CurrentUser() user: any,
    @Param('userId') userId: string,
  ) {
    return this.blocksService.blockUser(
      user.id,
      userId,
    );
  }

  // =========================================================
  // UNBLOCK USER
  // DELETE /api/blocks/:userId
  // =========================================================

  @Delete(':userId')
  unblockUser(
    @CurrentUser() user: any,
    @Param('userId') userId: string,
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
  // GET /api/blocks/status/:userId
  // =========================================================

  @Get('status/:userId')
  getBlockStatus(
    @CurrentUser() user: any,
    @Param('userId') userId: string,
  ) {
    return this.blocksService.getBlockStatus(
      user.id,
      userId,
    );
  }
}