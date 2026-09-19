import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { normalizePhoneNumber } from '../common/utils/phone.util';

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

  // Generate a fixed OTP when testing, otherwise create a random one.
  private generateOtp(): string {
    if (process.env.USE_STATIC_OTP === 'true') {
      return process.env.STATIC_OTP || '1111';
    }

    return Math.floor(
      1000 + Math.random() * 9000,
    ).toString();
  }

  // Save an OTP with a 5 minute expiry.
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

  private async saveRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    // Keep only the latest refresh token for the user.
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

  private sanitizeUser(user: any) {
    const {
      password_hash,
      ...safeUser
    } = user;

    return safeUser;
  }

  async register(registerDto: RegisterDto) {
    const {
      countryCode,
      mobileNumber: localMobileNumber,
      password,
      confirmPassword,
    } = registerDto;

    // Convert the selected country code and local number to one format.
    const mobileNumber =
      normalizePhoneNumber(
        countryCode,
        localMobileNumber,
      );

    if (password !== confirmPassword) {
      throw new BadRequestException(
        'Passwords do not match.',
      );
    }

    const {
      data: existingUser,
      error: checkError,
    } = await supabase
      .from('users')
      .select(
        'id, is_mobile_verified',
      )
      .eq(
        'mobile_number',
        mobileNumber,
      )
      .maybeSingle();

    if (checkError) {
      throw new BadRequestException(
        checkError.message,
      );
    }

    if (existingUser) {
      if (
        !existingUser.is_mobile_verified
      ) {
        throw new ConflictException(
          'Registration already started. Please verify your OTP.',
        );
      }

      throw new ConflictException(
        'Mobile number already exists.',
      );
    }

    const passwordHash =
      await bcrypt.hash(
        password,
        12,
      );

    const otp =
      this.generateOtp();

    // Remove an older OTP before creating a new registration OTP.
    await supabase
      .from('otp_codes')
      .delete()
      .eq(
        'mobile_number',
        mobileNumber,
      );

    const {
      error: otpError,
    } = await supabase
      .from('otp_codes')
      .insert({
        mobile_number:
          mobileNumber,
        otp,
        password_hash:
          passwordHash,
        expires_at:
          new Date(
            Date.now() +
              5 * 60 * 1000,
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
      message:
        'OTP sent successfully.',
    };
  }

  async verifyRegisterOtp(
    verifyOtpDto: VerifyOtpDto,
  ) {
    const {
      countryCode,
      mobileNumber: localMobileNumber,
      otp,
    } = verifyOtpDto;

    const mobileNumber =
      normalizePhoneNumber(
        countryCode,
        localMobileNumber,
      );

    const {
      data: otpData,
      error: otpError,
    } = await supabase
      .from('otp_codes')
      .select('*')
      .eq(
        'mobile_number',
        mobileNumber,
      )
      .eq('otp', otp)
      .maybeSingle();

    if (otpError) {
      throw new BadRequestException(
        otpError.message,
      );
    }

    if (!otpData) {
      throw new UnauthorizedException(
        'Invalid OTP.',
      );
    }

    if (
      new Date(
        otpData.expires_at,
      ) < new Date()
    ) {
      throw new UnauthorizedException(
        'OTP has expired.',
      );
    }

    if (!otpData.password_hash) {
      throw new BadRequestException(
        'Registration data not found.',
      );
    }

    // The account is created only after the OTP is verified.
    const {
      data: user,
      error: userError,
    } = await supabase
      .from('users')
      .insert({
        mobile_number:
          mobileNumber,
        password_hash:
          otpData.password_hash,
        is_mobile_verified:
          true,
        is_profile_completed:
          false,
      })
      .select()
      .single();

    if (userError) {
      throw new BadRequestException(
        userError.message,
      );
    }

    await supabase
      .from('otp_codes')
      .delete()
      .eq(
        'mobile_number',
        mobileNumber,
      );

    const accessToken =
      this.createAccessToken(
        user,
      );

    const refreshToken =
      this.createRefreshToken(
        user,
      );

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

  async login(
    loginDto: LoginDto,
  ) {
    const {
      countryCode,
      mobileNumber: localMobileNumber,
      password,
    } = loginDto;

    const mobileNumber =
      normalizePhoneNumber(
        countryCode,
        localMobileNumber,
      );

    const {
      data: user,
      error,
    } = await supabase
      .from('users')
      .select('*')
      .eq(
        'mobile_number',
        mobileNumber,
      )
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

    const otp =
      this.generateOtp();

    await this.saveOtp(
      mobileNumber,
      otp,
    );

    console.log(
      `📲 Login OTP (${mobileNumber}) : ${otp}`,
    );

    return {
      success: true,
      message:
        'OTP sent successfully.',
    };
  }

  async verifyLoginOtp(
    verifyOtpDto: VerifyOtpDto,
  ) {
    const {
      countryCode,
      mobileNumber: localMobileNumber,
      otp,
    } = verifyOtpDto;

    const mobileNumber =
      normalizePhoneNumber(
        countryCode,
        localMobileNumber,
      );

    const {
      data: otpData,
      error,
    } = await supabase
      .from('otp_codes')
      .select('*')
      .eq(
        'mobile_number',
        mobileNumber,
      )
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
      new Date(
        otpData.expires_at,
      ) < new Date()
    ) {
      throw new UnauthorizedException(
        'OTP has expired.',
      );
    }

    await supabase
      .from('otp_codes')
      .delete()
      .eq(
        'mobile_number',
        mobileNumber,
      );

    const {
      data: user,
      error: userError,
    } = await supabase
      .from('users')
      .select('*')
      .eq(
        'mobile_number',
        mobileNumber,
      )
      .single();

    if (
      userError ||
      !user
    ) {
      throw new UnauthorizedException(
        'User not found.',
      );
    }

    await supabase
      .from('users')
      .update({
        is_online: true,
        last_seen:
          new Date().toISOString(),
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        user.id,
      );

    const accessToken =
      this.createAccessToken(
        user,
      );

    const refreshToken =
      this.createRefreshToken(
        user,
      );

    await this.saveRefreshToken(
      user.id,
      refreshToken,
    );

    // A notification problem should not stop the login.
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
      message:
        'Login successful.',
      accessToken,
      refreshToken,
      isProfileCompleted:
        user.is_profile_completed,
      user: safeUser,
    };
  }

  async resendOtp(
    countryCode: string,
    mobileNumber: string,
  ) {
    const normalizedMobileNumber =
      normalizePhoneNumber(
        countryCode,
        mobileNumber,
      );

    const {
      data: user,
      error,
    } = await supabase
      .from('users')
      .select('id')
      .eq(
        'mobile_number',
        normalizedMobileNumber,
      )
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

    const otp =
      this.generateOtp();

    await this.saveOtp(
      normalizedMobileNumber,
      otp,
    );

    console.log(
      `📲 Resend OTP (${normalizedMobileNumber}) : ${otp}`,
    );

    return {
      success: true,
      message:
        'OTP resent successfully.',
    };
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
  ) {
    const {
      countryCode,
      mobileNumber: localMobileNumber,
    } = dto;

    const mobileNumber =
      normalizePhoneNumber(
        countryCode,
        localMobileNumber,
      );

    const {
      data: user,
      error,
    } = await supabase
      .from('users')
      .select('id')
      .eq(
        'mobile_number',
        mobileNumber,
      )
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

    const otp =
      this.generateOtp();

    await this.saveOtp(
      mobileNumber,
      otp,
    );

    console.log(
      `📲 Forgot Password OTP (${mobileNumber}) : ${otp}`,
    );

    return {
      success: true,
      message:
        'OTP sent successfully.',
    };
  }

  async verifyForgotPasswordOtp(
    verifyOtpDto: VerifyOtpDto,
  ) {
    const {
      countryCode,
      mobileNumber: localMobileNumber,
      otp,
    } = verifyOtpDto;

    const mobileNumber =
      normalizePhoneNumber(
        countryCode,
        localMobileNumber,
      );

    const {
      data: otpData,
      error,
    } = await supabase
      .from('otp_codes')
      .select('*')
      .eq(
        'mobile_number',
        mobileNumber,
      )
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
      new Date(
        otpData.expires_at,
      ) < new Date()
    ) {
      throw new UnauthorizedException(
        'OTP has expired.',
      );
    }

    await supabase
      .from('otp_codes')
      .delete()
      .eq(
        'mobile_number',
        mobileNumber,
      );

    const resetToken =
      randomUUID();

    const expiresAt =
      new Date(
        Date.now() +
          10 * 60 * 1000,
      );

    const {
      error: tokenError,
    } = await supabase
      .from(
        'password_reset_tokens',
      )
      .insert({
        mobile_number:
          mobileNumber,
        token: resetToken,
        expires_at:
          expiresAt.toISOString(),
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

  async resetPassword(
    dto: ResetPasswordDto,
  ) {
    const {
      resetToken,
      newPassword,
      confirmPassword,
    } = dto;

    if (
      newPassword !==
      confirmPassword
    ) {
      throw new BadRequestException(
        'Passwords do not match.',
      );
    }

    const {
      data: tokenData,
      error: tokenError,
    } = await supabase
      .from(
        'password_reset_tokens',
      )
      .select('*')
      .eq(
        'token',
        resetToken,
      )
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
      new Date(
        tokenData.expires_at,
      ) < new Date()
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
        password_hash:
          passwordHash,
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

    // Password reset notification is optional and should not break the reset.
    if (
      !userError &&
      user
    ) {
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

    await supabase
      .from(
        'password_reset_tokens',
      )
      .delete()
      .eq(
        'token',
        resetToken,
      );

    return {
      success: true,
      message:
        'Password reset successfully.',
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

    if (
      newPassword !==
      confirmPassword
    ) {
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
      .eq(
        'id',
        userId,
      )
      .maybeSingle();

    if (
      error ||
      !user
    ) {
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
        password_hash:
          passwordHash,
      })
      .eq(
        'id',
        userId,
      );

    if (updateError) {
      throw new BadRequestException(
        updateError.message,
      );
    }

    // Don't fail the password change if notification creation has a problem.
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
      .eq(
        'token',
        refreshToken,
      )
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
      new Date(
        tokenData.expires_at,
      ) < new Date()
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
      .eq(
        'id',
        tokenData.user_id,
      )
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
      this.createAccessToken(
        user,
      );

    return {
      success: true,
      accessToken,
    };
  }

  async logout(
    dto: LogoutDto,
  ) {
    const {
      refreshToken,
    } = dto;

    const {
      data: tokenData,
      error: tokenError,
    } = await supabase
      .from('refresh_tokens')
      .select('user_id')
      .eq(
        'token',
        refreshToken,
      )
      .maybeSingle();

    if (
      tokenError ||
      !tokenData
    ) {
      throw new UnauthorizedException(
        'Invalid refresh token.',
      );
    }

    // Set the user offline when they log out.
    await supabase
      .from('users')
      .update({
        is_online: false,
        last_seen:
          new Date().toISOString(),
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        tokenData.user_id,
      );

    await supabase
      .from('refresh_tokens')
      .delete()
      .eq(
        'token',
        refreshToken,
      );

    return {
      success: true,
      message:
        'Logged out successfully.',
    };
  }
}