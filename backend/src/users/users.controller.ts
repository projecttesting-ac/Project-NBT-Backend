import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';

import { UsersService } from './users.service';
import { CreateProfileDto } from './dto/create-profile.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Post('create-profile')
  createProfile(
    @CurrentUser() user: any,
    @Body() dto: CreateProfileDto,
  ) {
    return this.usersService.createProfile(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: any) {
    return this.usersService.getMe(user.id);
  }
}