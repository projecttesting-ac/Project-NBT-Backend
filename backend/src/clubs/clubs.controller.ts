import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { ClubsService } from './clubs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('clubs')
export class ClubsController {
  constructor(
    private readonly clubsService: ClubsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@CurrentUser() user: any) {
    return this.clubsService.findAll(user.id);
  }

//  get suggested
  @UseGuards(JwtAuthGuard)
  @Get('suggested')
  getSuggested(@CurrentUser() user: any) {
    return this.clubsService.getSuggested(user.id);
  }
  @UseGuards(JwtAuthGuard)
@Get('my')
getMyClubs(@CurrentUser() user: any) {
  return this.clubsService.getMyClubs(user.id);
}
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
@UseGuards(JwtAuthGuard)
@Get(':clubId/members')
getMembers(
  @Param('clubId') clubId: string,
) {
  return this.clubsService.getMembers(clubId);
}
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
}