import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';

import { UsersService } from './users.service';

import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  // =========================================================
  // CREATE PROFILE
  // 60 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 60,
      ttl: 60 * 1000,
    },
  })
  @Post('create-profile')
  createProfile(
    @CurrentUser() user: any,
    @Body() dto: CreateProfileDto,
  ) {
    return this.usersService.createProfile(
      user.id,
      dto,
    );
  }

  // =========================================================
  // GET MY PROFILE
  // 60 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 60,
      ttl: 60 * 1000,
    },
  })
  @Get('me')
  getMe(
    @CurrentUser() user: any,
  ) {
    return this.usersService.getMe(
      user.id,
    );
  }

  // =========================================================
  // SET ONLINE
  // 60 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 60,
      ttl: 60 * 1000,
    },
  })
  @Patch('online')
  setOnline(
    @CurrentUser() user: any,
  ) {
    return this.usersService.setOnline(
      user.id,
    );
  }

  // =========================================================
  // SET OFFLINE
  // 60 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 60,
      ttl: 60 * 1000,
    },
  })
  @Patch('offline')
  setOffline(
    @CurrentUser() user: any,
  ) {
    return this.usersService.setOffline(
      user.id,
    );
  }

  // =========================================================
  // UPDATE PROFILE
  // 60 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 60,
      ttl: 60 * 1000,
    },
  })
  @Patch('me')
  updateProfile(
    @CurrentUser() user: any,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(
      user.id,
      dto,
    );
  }

  // =========================================================
  // CHECK USERNAME
  // 60 requests / 1 minute
  // =========================================================

  @Throttle({
    default: {
      limit: 60,
      ttl: 60 * 1000,
    },
  })
  @Get('check-username/:username')
  checkUsername(
    @Param('username') username: string,
  ) {
    return this.usersService.checkUsername(
      username,
    );
  }

  // =========================================================
  // UPLOAD AVATAR
  // 60 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 60,
      ttl: 60 * 1000,
    },
  })
  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  uploadAvatar(
    @CurrentUser() user: any,
    @UploadedFile() file: any,
  ) {
    return this.usersService.uploadAvatar(
      user.id,
      file,
    );
  }

  // =========================================================
  // GENERATE / GET MY QR
  // 30 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 30,
      ttl: 60 * 1000,
    },
  })
  @Post('qr')
  getMyQr(
    @CurrentUser() user: any,
  ) {
    return this.usersService.getMyQr(
      user.id,
    );
  }

  // =========================================================
  // RESOLVE QR PROFILE
  // 30 requests / 1 minute
  // =========================================================

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 30,
      ttl: 60 * 1000,
    },
  })
  @Get('qr/:qrId')
  resolveQrProfile(
    @Param('qrId') qrId: string,
  ) {
    return this.usersService.resolveQrProfile(
      qrId,
    );
  }
}