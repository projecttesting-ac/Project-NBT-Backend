
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
import { ProfileCompletedGuard } from '../auth/profile-completed.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('media')
@UseGuards(JwtAuthGuard, ProfileCompletedGuard)
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
  ) {}

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
    // Upload media for the logged-in user
    return this.mediaService.upload(
      user.id,
      file,
    );
  }

  @Get(':mediaId/url')
  getMediaUrl(
    @CurrentUser() user: any,
    @Param('mediaId') mediaId: string,
  ) {
    // Get the media URL
    return this.mediaService.getMediaUrl(
      user.id,
      mediaId,
    );
  }
}
