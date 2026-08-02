import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('verify-register-otp')
  verifyRegisterOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyRegisterOtp(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('verify-login-otp')
  verifyLoginOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyLoginOtp(dto);
  }

  @Post('resend-otp')
  resendOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.resendOtp(dto.mobileNumber);
  }
  @Post('forgot-password')
forgotPassword(@Body() dto: ForgotPasswordDto) {
  return this.authService.forgotPassword(dto);
}

@Post('verify-forgot-password-otp')
verifyForgotPasswordOtp(@Body() dto: VerifyOtpDto) {
  return this.authService.verifyForgotPasswordOtp(dto);
}

@Post('reset-password')
resetPassword(@Body() dto: ResetPasswordDto) {
  return this.authService.resetPassword(dto);
}
@UseGuards(JwtAuthGuard)
@Post('change-password')
changePassword(
  @CurrentUser() user: any,
  @Body() dto: ChangePasswordDto,
) {
  return this.authService.changePassword(user.id, dto);
}
}