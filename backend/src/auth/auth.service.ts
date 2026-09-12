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
import { ChangePasswordDto } from './dto/change-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';

import { supabase } from '../config/supabase';
import { randomUUID } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // =========================================================
  // GENERATE OTP
  // =========================================================

  private generateOtp(): string {
    if (process.env.USE_STATIC_OTP === 'true') {
      return process.env.STATIC_OTP || '1111';
    }

    return Math.floor(
      1000 + Math.random() * 9000,
    ).toString();
  }

  // =========================================================
  // SAVE OTP
  // =========================================================

  private async saveOtp(
    mobileNumber: string,
    otp: string,
  ): Promise<void> {
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
      throw new BadRequestException(
        error.message,
      );
    }
  }

  // =========================================================
  // CREATE ACCESS TOKEN
  // =========================================================

  private createAccessToken(user: any): string {
    return this.jwtService.sign(
      {
        id: user.id,
        mobileNumber: user.mobile_number,
      },
      {
        expiresIn: '15m',
      },
    );
  }

  // =========================================================
  // CREATE REFRESH TOKEN
  // =========================================================

  private createRefreshToken(user: any): string {
    return this.jwtService.sign(
      {
        id: user.id,
      },
      {
        expiresIn: '30d',
      },
    );
  }

  // =========================================================
  // SAVE REFRESH TOKEN
  // =========================================================

  private async saveRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    // Delete previous refresh token
    await supabase
      .from('refresh_tokens')
      .delete()
      .eq('user_id', userId);

    const expiresAt = new Date(
      Date.now() +
        30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { error } = await supabase
      .from('refresh_tokens')
      .insert({
        user_id: userId,
        token: refreshToken,
        expires_at: expiresAt,
      });

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }
  }

  // =========================================================
  // SANITIZE USER
  // =========================================================

  private sanitizeUser(user: any) {
    const {
      password_hash,
      ...safeUser
    } = user;

    return safeUser;
  }

  // =========================================================
  // REGISTER
  // =========================================================

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

    // Check whether mobile number is already registered
    const {
      data: existingUser,
      error: checkError,
    } = await supabase
      .from('users')
      .select('id, is_mobile_verified')
      .eq('mobile_number', mobileNumber)
      .maybeSingle();

    if (checkError) {
      throw new BadRequestException(
        checkError.message,
      );
    }

    if (existingUser) {
      if (!existingUser.is_mobile_verified) {
        throw new ConflictException(
          'Registration already started. Please verify your OTP.',
        );
      }

      throw new ConflictException(
        'Mobile number already exists.',
      );
    }

    // Hash password temporarily
    const passwordHash = await bcrypt.hash(
      password,
      12,
    );

    // Generate OTP
    const otp = this.generateOtp();

    // Remove any previous registration OTP
    await supabase
      .from('otp_codes')
      .delete()
      .eq('mobile_number', mobileNumber);

    // Save OTP + password temporarily
    const {
      error: otpError,
    } = await supabase
      .from('otp_codes')
      .insert({
        mobile_number: mobileNumber,
        otp,
        password_hash: passwordHash,
        expires_at: new Date(
          Date.now() + 5 * 60 * 1000,
        ).toISOString(),
      });

    if (otpError) {
      throw new BadRequestException(
        otpError.message,
      );
    }

    console.log(
      `📲 Register OTP (${mobileNumber}) : ${otp}`,
    );

    return {
      success: true,
      message: 'OTP sent successfully.',
    };
  }

  // =========================================================
  // VERIFY REGISTER OTP
  // =========================================================

  async verifyRegisterOtp(
    verifyOtpDto: VerifyOtpDto,
  ) {
    const {
      mobileNumber,
      otp,
    } = verifyOtpDto;

    // Find matching OTP
    const {
      data: otpData,
      error: otpError,
    } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('mobile_number', mobileNumber)
      .eq('otp', otp)
      .maybeSingle();

    if (otpError) {
      throw new BadRequestException(
        otpError.message,
      );
    }

    // Wrong OTP
    if (!otpData) {
      throw new UnauthorizedException(
        'Invalid OTP.',
      );
    }

    // OTP expired
    if (
      new Date(otpData.expires_at) < new Date()
    ) {
      throw new UnauthorizedException(
        'OTP has expired.',
      );
    }

    // Password was not saved with registration OTP
    if (!otpData.password_hash) {
      throw new BadRequestException(
        'Registration data not found.',
      );
    }

    // Create user ONLY after correct OTP
    const {
      data: user,
      error: userError,
    } = await supabase
      .from('users')
      .insert({
        mobile_number: mobileNumber,
        password_hash: otpData.password_hash,
        is_mobile_verified: true,
        is_profile_completed: false,
      })
      .select()
      .single();

    if (userError) {
      throw new BadRequestException(
        userError.message,
      );
    }

    // Delete OTP after successful verification
    await supabase
      .from('otp_codes')
      .delete()
      .eq('mobile_number', mobileNumber);

    // Create tokens
    const accessToken =
      this.createAccessToken(user);

    const refreshToken =
      this.createRefreshToken(user);

    await this.saveRefreshToken(
      user.id,
      refreshToken,
    );

    return {
      success: true,
      message:
        'Registration completed successfully.',
      accessToken,
      refreshToken,
      isProfileCompleted:
        user.is_profile_completed,
    };
  }

  // =========================================================
  // LOGIN
  // =========================================================

  async login(loginDto: LoginDto) {
    const {
      mobileNumber,
      password,
    } = loginDto;

    const {
      data: user,
      error,
    } = await supabase
      .from('users')
      .select('*')
      .eq('mobile_number', mobileNumber)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    if (!user) {
      throw new UnauthorizedException(
        'Invalid mobile number or password.',
      );
    }

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.password_hash,
      );

    if (!passwordMatches) {
      throw new UnauthorizedException(
        'Invalid mobile number or password.',
      );
    }

    const otp = this.generateOtp();

    await this.saveOtp(
      mobileNumber,
      otp,
    );

    console.log(
      `📲 Login OTP (${mobileNumber}) : ${otp}`,
    );

    return {
      success: true,
      message: 'OTP sent successfully.',
    };
  }

  // =========================================================
  // VERIFY LOGIN OTP
  // =========================================================

  async verifyLoginOtp(
    verifyOtpDto: VerifyOtpDto,
  ) {
    const {
      mobileNumber,
      otp,
    } = verifyOtpDto;

    const {
      data: otpData,
      error,
    } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('mobile_number', mobileNumber)
      .eq('otp', otp)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    if (!otpData) {
      throw new UnauthorizedException(
        'Invalid OTP.',
      );
    }

    if (
      new Date(otpData.expires_at) < new Date()
    ) {
      throw new UnauthorizedException(
        'OTP has expired.',
      );
    }

    await supabase
      .from('otp_codes')
      .delete()
      .eq('mobile_number', mobileNumber);

    const {
      data: user,
      error: userError,
    } = await supabase
      .from('users')
      .select('*')
      .eq('mobile_number', mobileNumber)
      .single();

    if (userError || !user) {
      throw new UnauthorizedException(
        'User not found.',
      );
    }

    await supabase
      .from('users')
      .update({
        is_online: true,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    const accessToken =
      this.createAccessToken(user);

    const refreshToken =
      this.createRefreshToken(user);

    await this.saveRefreshToken(
      user.id,
      refreshToken,
    );

    // =======================================================
    // CREATE NEW LOGIN NOTIFICATION
    // =======================================================

    // Notification failure must NOT break login.
    await this.notificationsService
      .tryCreateNotification(
        user.id,
        'NEW_LOGIN',
        'New login',
        'Your account was just signed in.',
        undefined,
        user.id,
        'USER',
      );

    const {
      password_hash,
      refresh_token,
      ...safeUser
    } = user;

    return {
      success: true,
      message: 'Login successful.',
      accessToken,
      refreshToken,
      isProfileCompleted:
        user.is_profile_completed,
      user: safeUser,
    };
  }

  // =========================================================
  // RESEND OTP
  // =========================================================

  async resendOtp(
    mobileNumber: string,
  ) {
    const {
      data: user,
      error,
    } = await supabase
      .from('users')
      .select('id')
      .eq('mobile_number', mobileNumber)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    if (!user) {
      throw new UnauthorizedException(
        'User not found.',
      );
    }

    const otp = this.generateOtp();

    await this.saveOtp(
      mobileNumber,
      otp,
    );

    console.log(
      `📲 Resend OTP (${mobileNumber}) : ${otp}`,
    );

    return {
      success: true,
      message: 'OTP resent successfully.',
    };
  }

  // =========================================================
  // FORGOT PASSWORD
  // =========================================================

  async forgotPassword(
    dto: ForgotPasswordDto,
  ) {
    const {
      mobileNumber,
    } = dto;

    const {
      data: user,
      error,
    } = await supabase
      .from('users')
      .select('id')
      .eq('mobile_number', mobileNumber)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    if (!user) {
      throw new UnauthorizedException(
        'User not found.',
      );
    }

    const otp = this.generateOtp();

    await this.saveOtp(
      mobileNumber,
      otp,
    );

    console.log(
      `📲 Forgot Password OTP (${mobileNumber}) : ${otp}`,
    );

    return {
      success: true,
      message: 'OTP sent successfully.',
    };
  }

  // =========================================================
  // VERIFY FORGOT PASSWORD OTP
  // =========================================================

  async verifyForgotPasswordOtp(
    verifyOtpDto: VerifyOtpDto,
  ) {
    const {
      mobileNumber,
      otp,
    } = verifyOtpDto;

    const {
      data: otpData,
      error,
    } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('mobile_number', mobileNumber)
      .eq('otp', otp)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    if (!otpData) {
      throw new UnauthorizedException(
        'Invalid OTP.',
      );
    }

    if (
      new Date(otpData.expires_at) < new Date()
    ) {
      throw new UnauthorizedException(
        'OTP has expired.',
      );
    }

    await supabase
      .from('otp_codes')
      .delete()
      .eq('mobile_number', mobileNumber);

    const resetToken = randomUUID();

    const expiresAt = new Date(
      Date.now() + 10 * 60 * 1000,
    );

    const {
      error: tokenError,
    } = await supabase
      .from('password_reset_tokens')
      .insert({
        mobile_number: mobileNumber,
        token: resetToken,
        expires_at: expiresAt.toISOString(),
      });

    if (tokenError) {
      throw new BadRequestException(
        tokenError.message,
      );
    }

    return {
      success: true,
      message:
        'OTP verified successfully.',
      resetToken,
    };
  }

  // =========================================================
  // RESET PASSWORD
  // =========================================================

  async resetPassword(
    dto: ResetPasswordDto,
  ) {
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

    const {
      data: tokenData,
      error: tokenError,
    } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token', resetToken)
      .maybeSingle();

    if (
      tokenError ||
      !tokenData
    ) {
      throw new UnauthorizedException(
        'Invalid reset token.',
      );
    }

    if (
      new Date(tokenData.expires_at) < new Date()
    ) {
      throw new UnauthorizedException(
        'Reset token has expired.',
      );
    }

    const passwordHash =
      await bcrypt.hash(
        newPassword,
        12,
      );

    const {
      error: updateError,
    } = await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
      })
      .eq(
        'mobile_number',
        tokenData.mobile_number,
      );

    if (updateError) {
      throw new BadRequestException(
        updateError.message,
      );
    }

    // =======================================================
    // GET USER ID FOR NOTIFICATION
    // =======================================================

    const {
      data: user,
      error: userError,
    } = await supabase
      .from('users')
      .select('id')
      .eq(
        'mobile_number',
        tokenData.mobile_number,
      )
      .maybeSingle();

    // =======================================================
    // CREATE PASSWORD CHANGED NOTIFICATION
    // =======================================================

    // Notification failure must NOT break password reset.
    if (!userError && user) {
      await this.notificationsService
        .tryCreateNotification(
          user.id,
          'PASSWORD_CHANGED',
          'Password changed',
          'Your password was changed successfully.',
          undefined,
          user.id,
          'USER',
        );
    }

    // Delete used reset token
    await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('token', resetToken);

    return {
      success: true,
      message:
        'Password reset successfully.',
    };
  }

  // =========================================================
  // CHANGE PASSWORD
  // =========================================================

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

    const {
      data: user,
      error,
    } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error || !user) {
      throw new UnauthorizedException(
        'User not found.',
      );
    }

    const isPasswordValid =
      await bcrypt.compare(
        currentPassword,
        user.password_hash,
      );

    if (!isPasswordValid) {
      throw new UnauthorizedException(
        'Current password is incorrect.',
      );
    }

    const passwordHash =
      await bcrypt.hash(
        newPassword,
        12,
      );

    const {
      error: updateError,
    } = await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
      })
      .eq('id', userId);

    if (updateError) {
      throw new BadRequestException(
        updateError.message,
      );
    }

    // =======================================================
    // CREATE PASSWORD CHANGED NOTIFICATION
    // =======================================================

    // Notification failure must NOT break password change.
    await this.notificationsService
      .tryCreateNotification(
        userId,
        'PASSWORD_CHANGED',
        'Password changed',
        'Your password was changed successfully.',
        undefined,
        userId,
        'USER',
      );

    return {
      success: true,
      message:
        'Password changed successfully.',
    };
  }

  // =========================================================
  // REFRESH TOKEN
  // =========================================================

  async refreshToken(
    dto: RefreshTokenDto,
  ) {
    const {
      refreshToken,
    } = dto;

    const {
      data: tokenData,
      error,
    } = await supabase
      .from('refresh_tokens')
      .select('*')
      .eq('token', refreshToken)
      .maybeSingle();

    if (
      error ||
      !tokenData
    ) {
      throw new UnauthorizedException(
        'Invalid refresh token.',
      );
    }

    if (
      new Date(tokenData.expires_at) < new Date()
    ) {
      throw new UnauthorizedException(
        'Refresh token has expired.',
      );
    }

    const {
      data: user,
      error: userError,
    } = await supabase
      .from('users')
      .select('*')
      .eq('id', tokenData.user_id)
      .maybeSingle();

    if (
      userError ||
      !user
    ) {
      throw new UnauthorizedException(
        'User not found.',
      );
    }

    const accessToken =
      this.createAccessToken(user);

    return {
      success: true,
      accessToken,
    };
  }

  // =========================================================
  // LOGOUT
  // =========================================================

  async logout(
    dto: LogoutDto,
  ) {
    const {
      refreshToken,
    } = dto;

    // Find the refresh token
    const {
      data: tokenData,
      error: tokenError,
    } = await supabase
      .from('refresh_tokens')
      .select('user_id')
      .eq('token', refreshToken)
      .maybeSingle();

    if (
      tokenError ||
      !tokenData
    ) {
      throw new UnauthorizedException(
        'Invalid refresh token.',
      );
    }

    // Mark user offline
    await supabase
      .from('users')
      .update({
        is_online: false,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq(
        'id',
        tokenData.user_id,
      );

    // Delete refresh token
    const {
      error,
    } = await supabase
      .from('refresh_tokens')
      .delete()
      .eq(
        'token',
        refreshToken,
      );

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    return {
      success: true,
      message:
        'Logged out successfully.',
    };
  }
}