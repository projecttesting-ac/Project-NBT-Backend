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
    // create the user's profile
    return this.usersService.createProfile(
      user.id,
      dto,
    );
  }

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
    // get the logged in user's profile
    return this.usersService.getMe(
      user.id,
    );
  }

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
    // mark the user as online
    return this.usersService.setOnline(
      user.id,
    );
  }

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
    // mark the user as offline
    return this.usersService.setOffline(
      user.id,
    );
  }

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
    // update the user's profile
    return this.usersService.updateProfile(
      user.id,
      dto,
    );
  }

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
    // check if the username is available
    return this.usersService.checkUsername(
      username,
    );
  }

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
    // upload the user's avatar
    return this.usersService.uploadAvatar(
      user.id,
      file,
    );
  }

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
    // get the user's QR data
    return this.usersService.getMyQr(
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
  @Get('qr/:qrId')
  resolveQrProfile(
    @Param('qrId') qrId: string,
  ) {
    // find the profile linked to the QR
    return this.usersService.resolveQrProfile(
      qrId,
    );
  }
}