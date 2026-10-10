
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

import { PaginationDto } from '../common/dto/pagination.dto';
import { ClubsService } from './clubs.service';
import { CreateClubDto } from './dto/create-club.dto';
import { UpdateClubDto } from './dto/update-club.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProfileCompletedGuard } from '../auth/profile-completed.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('clubs')
@UseGuards(JwtAuthGuard, ProfileCompletedGuard)
export class ClubsController {
  constructor(
    private readonly clubsService: ClubsService,
  ) {}

  @Throttle({
    default: {
      limit: 30,
      ttl: 60 * 1000,
    },
  })
  @Post()
  createClub(
    @CurrentUser() user: any,
    @Body() dto: CreateClubDto,
  ) {
    return this.clubsService.createClub(
      user.id,
      dto,
    );
  }

  @Throttle({
    default: {
      limit: 30,
      ttl: 60 * 1000,
    },
  })
  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query() pagination: PaginationDto,
  ) {
    return this.clubsService.findAll(
      user.id,
      pagination,
    );
  }

  @Throttle({
    default: {
      limit: 30,
      ttl: 60 * 1000,
    },
  })
  @Get('suggested')
  getSuggested(
    @CurrentUser() user: any,
  ) {
    return this.clubsService.getSuggested(
      user.id,
    );
  }

  @Throttle({
    default: {
      limit: 30,
      ttl: 60 * 1000,
    },
  })
  @Get('my')
  getMyClubs(
    @CurrentUser() user: any,
  ) {
    return this.clubsService.getMyClubs(
      user.id,
    );
  }

  @Throttle({
    default: {
      limit: 30,
      ttl: 60 * 1000,
    },
  })
  @Get(':clubId')
  getOne(
    @CurrentUser() user: any,
    @Param('clubId') clubId: string,
  ) {
    return this.clubsService.getOne(
      user.id,
      clubId,
    );
  }

  @Throttle({
    default: {
      limit: 30,
      ttl: 60 * 1000,
    },
  })
  @Get(':clubId/members')
  getMembers(
    @Param('clubId') clubId: string,
  ) {
    return this.clubsService.getMembers(
      clubId,
    );
  }

  @Throttle({
    default: {
      limit: 20,
      ttl: 60 * 1000,
    },
  })
  @Post(':clubId/join')
  joinClub(
    @CurrentUser() user: any,
    @Param('clubId') clubId: string,
  ) {
    return this.clubsService.joinClub(
      user.id,
      clubId,
    );
  }

  @Throttle({
    default: {
      limit: 20,
      ttl: 60 * 1000,
    },
  })
  @Delete(':clubId/leave')
  leaveClub(
    @CurrentUser() user: any,
    @Param('clubId') clubId: string,
  ) {
    return this.clubsService.leaveClub(
      user.id,
      clubId,
    );
  }

  @Throttle({
    default: {
      limit: 30,
      ttl: 60 * 1000,
    },
  })
  @Patch(':clubId')
  updateClub(
    @CurrentUser() user: any,
    @Param('clubId') clubId: string,
    @Body() dto: UpdateClubDto,
  ) {
    return this.clubsService.updateClub(
      user.id,
      clubId,
      dto,
    );
  }

  @Throttle({
    default: {
      limit: 30,
      ttl: 60 * 1000,
    },
  })
  @Delete(':clubId')
  deleteClub(
    @CurrentUser() user: any,
    @Param('clubId') clubId: string,
  ) {
    return this.clubsService.deleteClub(
      user.id,
      clubId,
    );
  }

  @Throttle({
    default: {
      limit: 20,
      ttl: 60 * 1000,
    },
  })
  @Delete(':clubId/members/:userId')
  removeMember(
    @CurrentUser() user: any,
    @Param('clubId') clubId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.clubsService.removeMember(
      user.id,
      clubId,
      targetUserId,
    );
  }

  @Throttle({
    default: {
      limit: 20,
      ttl: 60 * 1000,
    },
  })
  @Patch(':clubId/members/:userId/role')
  updateMemberRole(
    @CurrentUser() user: any,
    @Param('clubId') clubId: string,
    @Param('userId') targetUserId: string,
    @Body('role') role: string,
  ) {
    return this.clubsService.updateMemberRole(
      user.id,
      clubId,
      targetUserId,
      role,
    );
  }
}
