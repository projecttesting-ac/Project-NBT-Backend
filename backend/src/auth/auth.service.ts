import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { supabase } from '../config/supabase';
import { ChangePasswordDto } from './dto/change-password.dto';
import { randomUUID } from 'crypto';
@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  private generateOtp(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  private async saveOtp(
    mobileNumber: string,
    otp: string,
  ): Promise<void> {
    await supabase
      .from('otp_codes')
      .delete()
      .eq('mobile_number', mobileNumber);

    const expiresAt = new Date(
      Date.now() + 5 * 60 * 1000,
    ).toISOString();

    const { error } = await supabase
      .from('otp_codes')
      .insert({
        mobile_number: mobileNumber,
        otp,
        expires_at: expiresAt,
      });

    if (error) {
      throw new BadRequestException(error.message);
    }
  }

  private createToken(user: any): string {
    return this.jwtService.sign({
      id: user.id,
      mobileNumber: user.mobile_number,
    });
  }

  private sanitizeUser(user: any) {
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }

  async register(registerDto: RegisterDto) {
    const {
      mobileNumber,
      password,
      confirmPassword,
    } = registerDto;

    if (password !== confirmPassword) {
      throw new BadRequestException(
        'Passwords do not match.',
      );
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('mobile_number', mobileNumber)
      .maybeSingle();

    if (existingUser) {
      throw new ConflictException(
        'Mobile number already exists.',
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { error } = await supabase
      .from('users')
      .insert({
        mobile_number: mobileNumber,
        password_hash: passwordHash,
        is_mobile_verified: false,
        is_profile_completed: false,
      });

    if (error) {
      throw new BadRequestException(error.message);
    }

    const otp = this.generateOtp();

    await this.saveOtp(mobileNumber, otp);

    console.log(
      `📲 Register OTP (${mobileNumber}) : ${otp}`,
    );

    return {
      success: true,
      message: 'OTP sent successfully.',
    };
  }
    async verifyRegisterOtp(verifyOtpDto: VerifyOtpDto) {
    const { mobileNumber, otp } = verifyOtpDto;

    const { data: otpData, error } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('mobile_number', mobileNumber)
      .eq('otp', otp)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }

    if (!otpData) {
      throw new UnauthorizedException('Invalid OTP.');
    }

    if (new Date(otpData.expires_at) < new Date()) {
      throw new UnauthorizedException('OTP has expired.');
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({
        is_mobile_verified: true,
      })
      .eq('mobile_number', mobileNumber);

    if (updateError) {
      throw new BadRequestException(updateError.message);
    }

    await supabase
      .from('otp_codes')
      .delete()
      .eq('mobile_number', mobileNumber);

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('mobile_number', mobileNumber)
      .single();

    if (userError || !user) {
      throw new UnauthorizedException('User not found.');
    }

    const accessToken = this.createToken(user);

    return {
      success: true,
      message: 'Mobile number verified successfully.',
      accessToken,
      isProfileCompleted: user.is_profile_completed,
      user: this.sanitizeUser(user),
    };
  }

  async login(loginDto: LoginDto) {
    const { mobileNumber, password } = loginDto;

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('mobile_number', mobileNumber)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }

    if (!user) {
      throw new UnauthorizedException(
        'Invalid mobile number or password.',
      );
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException(
        'Invalid mobile number or password.',
      );
    }

    const otp = this.generateOtp();

    await this.saveOtp(mobileNumber, otp);

    console.log(
      `📲 Login OTP (${mobileNumber}) : ${otp}`,
    );

    return {
      success: true,
      message: 'OTP sent successfully.',
    };
  }
    async verifyLoginOtp(verifyOtpDto: VerifyOtpDto) {
    const { mobileNumber, otp } = verifyOtpDto;

    const { data: otpData, error } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('mobile_number', mobileNumber)
      .eq('otp', otp)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }

    if (!otpData) {
      throw new UnauthorizedException('Invalid OTP.');
    }

    if (new Date(otpData.expires_at) < new Date()) {
      throw new UnauthorizedException('OTP has expired.');
    }

    await supabase
      .from('otp_codes')
      .delete()
      .eq('mobile_number', mobileNumber);

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('mobile_number', mobileNumber)
      .single();

    if (userError || !user) {
      throw new UnauthorizedException('User not found.');
    }

    const accessToken = this.createToken(user);

    return {
      success: true,
      message: 'Login successful.',
      accessToken,
      isProfileCompleted: user.is_profile_completed,
      user: this.sanitizeUser(user),
    };
  }

  async resendOtp(mobileNumber: string) {
    const { data: user, error } = await supabase
      .from('users')
      .select('id')
      .eq('mobile_number', mobileNumber)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    const otp = this.generateOtp();

    await this.saveOtp(mobileNumber, otp);

    console.log(`📲 Resend OTP (${mobileNumber}) : ${otp}`);

    return {
      success: true,
      message: 'OTP resent successfully.',
    };
  }
  async forgotPassword(dto: ForgotPasswordDto) {
  const { mobileNumber } = dto;

  const { data: user, error } = await supabase
    .from('users')
    .select('id')
    .eq('mobile_number', mobileNumber)
    .maybeSingle();

  if (error) {
    throw new BadRequestException(error.message);
  }

  if (!user) {
    throw new UnauthorizedException('User not found.');
  }

  const otp = this.generateOtp();

  await this.saveOtp(mobileNumber, otp);

  console.log(
    `📲 Forgot Password OTP (${mobileNumber}) : ${otp}`,
  );

  return {
    success: true,
    message: 'OTP sent successfully.',
  };
}
async verifyForgotPasswordOtp(verifyOtpDto: VerifyOtpDto) {
  const { mobileNumber, otp } = verifyOtpDto;

  const { data: otpData, error } = await supabase
    .from('otp_codes')
    .select('*')
    .eq('mobile_number', mobileNumber)
    .eq('otp', otp)
    .maybeSingle();

  if (error) {
    throw new BadRequestException(error.message);
  }

  if (!otpData) {
    throw new UnauthorizedException('Invalid OTP.');
  }

  if (new Date(otpData.expires_at) < new Date()) {
    throw new UnauthorizedException('OTP has expired.');
  }

  await supabase
    .from('otp_codes')
    .delete()
    .eq('mobile_number', mobileNumber);

  const resetToken = randomUUID();

const expiresAt = new Date(
  Date.now() + 10 * 60 * 1000,
);

const { error: tokenError } = await supabase
  .from('password_reset_tokens')
  .insert({
    mobile_number: mobileNumber,
    token: resetToken,
    expires_at: expiresAt.toISOString(),
  });

if (tokenError) {
  throw new BadRequestException(tokenError.message);
}

return {
  success: true,
  message: 'OTP verified successfully.',
  resetToken,
};
}
async resetPassword(dto: ResetPasswordDto) {
  const {
    resetToken,
    newPassword,
    confirmPassword,
  } = dto;

  if (newPassword !== confirmPassword) {
    throw new BadRequestException(
      'Passwords do not match.',
    );
  }

  const { data: tokenData, error: tokenError } = await supabase
    .from('password_reset_tokens')
    .select('*')
    .eq('token', resetToken)
    .maybeSingle();

  if (tokenError || !tokenData) {
    throw new UnauthorizedException('Invalid reset token.');
  }

  if (new Date(tokenData.expires_at) < new Date()) {
    throw new UnauthorizedException('Reset token has expired.');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  const { error: updateError } = await supabase
    .from('users')
    .update({
      password_hash: passwordHash,
    })
    .eq('mobile_number', tokenData.mobile_number);

  if (updateError) {
    throw new BadRequestException(updateError.message);
  }

  await supabase
    .from('password_reset_tokens')
    .delete()
    .eq('token', resetToken);

  return {
    success: true,
    message: 'Password reset successfully.',
  };
}
async changePassword(
  userId: string,
  dto: ChangePasswordDto,
) {
  const {
    currentPassword,
    newPassword,
    confirmPassword,
  } = dto;

  if (newPassword !== confirmPassword) {
    throw new BadRequestException(
      'Passwords do not match.',
    );
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error || !user) {
    throw new UnauthorizedException('User not found.');
  }

  const isPasswordValid = await bcrypt.compare(
    currentPassword,
    user.password_hash,
  );

  if (!isPasswordValid) {
    throw new UnauthorizedException(
      'Current password is incorrect.',
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  const { error: updateError } = await supabase
    .from('users')
    .update({
      password_hash: passwordHash,
    })
    .eq('id', userId);

  if (updateError) {
    throw new BadRequestException(updateError.message);
  }

  return {
    success: true,
    message: 'Password changed successfully.',
  };
}
}