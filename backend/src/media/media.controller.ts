import {
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';

import { MediaService } from './media.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('media')
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
  ) {}

  // =========================================================
  // MEDIA UPLOAD
  // 20 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 20,
      ttl: 60 * 1000,
    },
  })
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() user: any,
    @UploadedFile() file: any,
  ) {
    return this.mediaService.upload(
      user.id,
      file,
    );
  }

  // =========================================================
  // GET MEDIA URL
  // Global authenticated fallback:
  // 100 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Get(':mediaId/url')
  getMediaUrl(
    @CurrentUser() user: any,
    @Param('mediaId') mediaId: string,
  ) {
    return (this.mediaService as any).getMediaUrl(
      user.id,
      mediaId,
    );
  }
}