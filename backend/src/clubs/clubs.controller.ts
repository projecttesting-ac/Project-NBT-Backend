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
    // create a new club
    return this.clubsService.createClub(
      user.id,
      dto,
    );
  }

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
    // get clubs for the current user
    return this.clubsService.findAll(
      user.id,
      pagination,
    );
  }

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
    // get clubs suggested for the user
    return this.clubsService.getSuggested(
      user.id,
    );
  }

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
    // get clubs the user has joined
    return this.clubsService.getMyClubs(
      user.id,
    );
  }

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
    // get one club
    return this.clubsService.getOne(
      user.id,
      clubId,
    );
  }

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
    // get all members of the club
    return this.clubsService.getMembers(
      clubId,
    );
  }

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
    // join a club
    return this.clubsService.joinClub(
      user.id,
      clubId,
    );
  }

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
    // leave a club
    return this.clubsService.leaveClub(
      user.id,
      clubId,
    );
  }

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
    // update club details
    return this.clubsService.updateClub(
      user.id,
      clubId,
      dto,
    );
  }

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
    // delete the club
    return this.clubsService.deleteClub(
      user.id,
      clubId,
    );
  }

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
    // remove a member from the club
    return this.clubsService.removeMember(
      user.id,
      clubId,
      targetUserId,
    );
  }

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
    // change a member's role
    return this.clubsService.updateMemberRole(
      user.id,
      clubId,
      targetUserId,
      role,
    );
  }
}