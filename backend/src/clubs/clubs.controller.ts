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
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('clubs')
export class ClubsController {
  constructor(
    private readonly clubsService: ClubsService,
  ) {}

  // =========================================================
  // CREATE CLUB
  // 30 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
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

  // =========================================================
  // GET ALL CLUBS
  // 30 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
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

  // =========================================================
  // GET SUGGESTED CLUBS
  // 30 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
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

  // =========================================================
  // GET MY CLUBS
  // 30 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
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

  // =========================================================
  // GET SINGLE CLUB
  // 30 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
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

  // =========================================================
  // GET CLUB MEMBERS
  // 30 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
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

  // =========================================================
  // JOIN CLUB
  // 20 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
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

  // =========================================================
  // LEAVE CLUB
  // 20 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
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

  // =========================================================
  // UPDATE CLUB
  // 30 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
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

  // =========================================================
  // DELETE CLUB
  // 30 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
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

  // =========================================================
  // REMOVE MEMBER
  // 20 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
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

  // =========================================================
  // CHANGE MEMBER ROLE
  // 20 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
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