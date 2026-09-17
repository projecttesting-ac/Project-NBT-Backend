import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { AuthService } from './auth.service';

import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 5 requests / 10 minutes
  @Throttle({
    default: {
      limit: 5,
      ttl: 10 * 60 * 1000,
    },
  })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    console.log('Register Called');
    console.log(dto);

    return this.authService.register(dto);
  }

  // 5 requests / 5 minutes
  @Throttle({
    default: {
      limit: 5,
      ttl: 5 * 60 * 1000,
    },
  })
  @Post('verify-register-otp')
  verifyRegisterOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyRegisterOtp(dto);
  }

  // 5 requests / 1 minute
  @Throttle({
    default: {
      limit: 5,
      ttl: 60 * 1000,
    },
  })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // 5 requests / 5 minutes
  @Throttle({
    default: {
      limit: 5,
      ttl: 5 * 60 * 1000,
    },
  })
  @Post('verify-login-otp')
  verifyLoginOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyLoginOtp(dto);
  }

  // 3 requests / 10 minutes
  @Throttle({
    default: {
      limit: 3,
      ttl: 10 * 60 * 1000,
    },
  })
  @Post('resend-otp')
  resendOtp(@Body() dto: ResendOtpDto) {
return this.authService.resendOtp(
  dto.countryCode,
  dto.mobileNumber,
);  }

  // 3 requests / 10 minutes
  @Throttle({
    default: {
      limit: 3,
      ttl: 10 * 60 * 1000,
    },
  })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  // 5 requests / 5 minutes
  @Throttle({
    default: {
      limit: 5,
      ttl: 5 * 60 * 1000,
    },
  })
  @Post('verify-forgot-password-otp')
  verifyForgotPasswordOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyForgotPasswordOtp(dto);
  }

  // 5 requests / 10 minutes
  @Throttle({
    default: {
      limit: 5,
      ttl: 10 * 60 * 1000,
    },
  })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // 5 requests / 10 minutes
  @Throttle({
    default: {
      limit: 5,
      ttl: 10 * 60 * 1000,
    },
  })
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(
    @CurrentUser() user: any,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  @Post('refresh-token')
  refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Post('logout')
  logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto);
  }
}