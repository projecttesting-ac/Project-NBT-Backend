import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';

import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

import { ExploreService } from './explore.service';

@Controller('explore')
export class ExploreController {
  constructor(
    private readonly exploreService: ExploreService,
  ) {}

  @UseGuards(JwtAuthGuard)
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