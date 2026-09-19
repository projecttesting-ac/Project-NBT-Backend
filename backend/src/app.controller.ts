import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
  ) {}

  // Public / General API
  // 60 requests / 1 minute
  @Throttle({
    default: {
      limit: 60,
      ttl: 60 * 1000,
    },
  })
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}