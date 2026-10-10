
import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';

import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProfileCompletedGuard } from '../auth/profile-completed.guard';
import { CurrentUser } from '../auth/current-user.decorator';

import { ExploreService } from './explore.service';

@Controller('explore')
@UseGuards(JwtAuthGuard, ProfileCompletedGuard)
export class ExploreController {
  constructor(
    private readonly exploreService: ExploreService,
  ) {}

  @Throttle({
    default: {
      limit: 30,
      ttl: 60 * 1000,
    },
  })
  @Get()
  getExplore(
    @CurrentUser() user: any,
    @Query('query') query?: string,
  ) {
    return this.exploreService.getExplore(
      user.id,
      query,
    );
  }
}
