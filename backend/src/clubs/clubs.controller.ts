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
  // POST /api/clubs
  // =========================================================

  @UseGuards(JwtAuthGuard)
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
  // GET /api/clubs?page=1&limit=10
  // =========================================================

  @UseGuards(JwtAuthGuard)
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
  // GET /api/clubs/suggested
  // =========================================================

  @UseGuards(JwtAuthGuard)
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
  // GET /api/clubs/my
  // =========================================================

  @UseGuards(JwtAuthGuard)
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
  // GET /api/clubs/:clubId
  // =========================================================

  @UseGuards(JwtAuthGuard)
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
  // GET /api/clubs/:clubId/members
  // =========================================================

  @UseGuards(JwtAuthGuard)
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
  // POST /api/clubs/:clubId/join
  // =========================================================

  @UseGuards(JwtAuthGuard)
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
  // DELETE /api/clubs/:clubId/leave
  // =========================================================

  @UseGuards(JwtAuthGuard)
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
  // PATCH /api/clubs/:clubId
  // =========================================================

  @UseGuards(JwtAuthGuard)
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
  // DELETE /api/clubs/:clubId
  // =========================================================

  @UseGuards(JwtAuthGuard)
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
  // DELETE /api/clubs/:clubId/members/:userId
  // =========================================================

  @UseGuards(JwtAuthGuard)
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
  // PATCH /api/clubs/:clubId/members/:userId/role
  // =========================================================

  @UseGuards(JwtAuthGuard)
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