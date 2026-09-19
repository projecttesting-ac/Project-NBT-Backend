import {
  ExecutionContext,
  Injectable,
} from '@nestjs/common';

import { ThrottlerGuard } from '@nestjs/throttler';

import type {
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';

import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import { supabase } from '../../config/supabase';

import { normalizePhoneNumber } from '../utils/phone.util';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  constructor(
    protected readonly options: ThrottlerModuleOptions,
    protected readonly storageService: ThrottlerStorage,
    protected readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {
    super(
      options,
      storageService,
      reflector,
    );
  }

  protected async getTracker(
    req: Record<string, any>,
  ): Promise<string> {
    const ip = this.getIpAddress(req);
    const path = this.getRequestPath(req);

    // use the phone number to keep login attempts separate by account
    if (path === '/auth/login') {
      return this.getPhoneAccountTracker(
        ip,
        req.body?.countryCode,
        req.body?.mobileNumber,
      );
    }

    // registration is limited by IP
    if (path === '/auth/register') {
      return `ip:${ip}`;
    }

    // keep OTP attempts tied to the account and IP
    if (
      path === '/auth/verify-login-otp'
    ) {
      return this.getPhoneAccountTracker(
        ip,
        req.body?.countryCode,
        req.body?.mobileNumber,
      );
    }

    if (
      path === '/auth/verify-register-otp'
    ) {
      return this.getPhoneAccountTracker(
        ip,
        req.body?.countryCode,
        req.body?.mobileNumber,
      );
    }

    if (path === '/auth/resend-otp') {
      return this.getPhoneAccountTracker(
        ip,
        req.body?.countryCode,
        req.body?.mobileNumber,
      );
    }

    if (
      path === '/auth/forgot-password'
    ) {
      return this.getPhoneAccountTracker(
        ip,
        req.body?.countryCode,
        req.body?.mobileNumber,
      );
    }

    if (
      path ===
      '/auth/verify-forgot-password-otp'
    ) {
      return this.getPhoneAccountTracker(
        ip,
        req.body?.countryCode,
        req.body?.mobileNumber,
      );
    }

    if (
      path === '/auth/reset-password'
    ) {
      return this.getResetPasswordTracker(
        ip,
        req.body?.resetToken,
      );
    }

    // authenticated password changes use the user ID
    if (
      path === '/auth/change-password'
    ) {
      const userId =
        await this.getAuthenticatedUserId(
          req,
        );

      if (userId) {
        return `user:${userId}`;
      }

      return `ip:${ip}`;
    }

    // use the user ID when logged in, otherwise use the IP
    if (
      path.startsWith(
        '/users/check-username/',
      )
    ) {
      const userId =
        await this.getAuthenticatedUserId(
          req,
        );

      if (userId) {
        return `user:${userId}`;
      }

      return `ip:${ip}`;
    }

    const userId =
      await this.getAuthenticatedUserId(
        req,
      );

    if (userId) {
      return `user:${userId}`;
    }

    // unauthenticated requests are tracked by IP
    return `ip:${ip}`;
  }

  private getIpAddress(
    req: Record<string, any>,
  ): string {
    const forwardedFor =
      req.headers?.['x-forwarded-for'];

    if (forwardedFor) {
      const firstIp =
        String(forwardedFor)
          .split(',')[0]
          .trim();

      if (firstIp) {
        return firstIp;
      }
    }

    return (
      req.ip ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }

  private getRequestPath(
    req: Record<string, any>,
  ): string {
    const path = String(
      req.path ||
        req.url?.split('?')[0] ||
        '',
    );

    return path.replace(
      /^\/api/,
      '',
    );
  }

  private getPhoneAccountTracker(
    ip: string,
    countryCode: unknown,
    mobileNumber: unknown,
  ): string {
    try {
      const normalizedPhone =
        normalizePhoneNumber(
          String(countryCode || ''),
          String(mobileNumber || ''),
        );

      return `ip:${ip}:account:${normalizedPhone}`;
    } catch {
      // fall back to IP when the phone number is invalid
      return `ip:${ip}`;
    }
  }

  private async getAuthenticatedUserId(
    req: Record<string, any>,
  ): Promise<string | null> {
    const authorization =
      req.headers?.authorization;

    if (
      !authorization ||
      typeof authorization !== 'string'
    ) {
      return null;
    }

    if (
      !authorization
        .toLowerCase()
        .startsWith('bearer ')
    ) {
      return null;
    }

    const token =
      authorization
        .substring(7)
        .trim();

    if (!token) {
      return null;
    }

    try {
      const payload =
        await this.jwtService.verifyAsync(
          token,
          {
            secret:
              process.env.JWT_SECRET ||
              'your-secret-key',
          },
        );

      if (!payload?.id) {
        return null;
      }

      return String(payload.id);
    } catch {
      return null;
    }
  }

  private async getResetPasswordTracker(
    ip: string,
    resetToken: unknown,
  ): Promise<string> {
    const token =
      resetToken === undefined ||
      resetToken === null
        ? ''
        : String(resetToken).trim();

    if (!token) {
      return `ip:${ip}`;
    }

    try {
      const {
        data: tokenData,
        error,
      } = await supabase
        .from('password_reset_tokens')
        .select(
          'mobile_number, expires_at',
        )
        .eq('token', token)
        .maybeSingle();

      if (
        error ||
        !tokenData
      ) {
        return `ip:${ip}`;
      }

      // expired tokens are handled with the IP limit
      if (
        new Date(
          tokenData.expires_at,
        ) < new Date()
      ) {
        return `ip:${ip}`;
      }

      const account =
        this.normalizeAccount(
          tokenData.mobile_number,
        );

      if (!account) {
        return `ip:${ip}`;
      }

      return `ip:${ip}:account:${account}`;
    } catch {
      // don't let a throttler lookup error break the request
      return `ip:${ip}`;
    }
  }

  private normalizeAccount(
    account: unknown,
  ): string | null {
    if (
      account === undefined ||
      account === null
    ) {
      return null;
    }

    const value =
      String(account).trim();

    if (!value) {
      return null;
    }

    return value.toLowerCase();
  }
}