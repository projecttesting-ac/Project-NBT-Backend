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

  // =========================================================
  // MAIN TRACKER
  // =========================================================

  protected async getTracker(
    req: Record<string, any>,
  ): Promise<string> {
    const ip = this.getIpAddress(req);

    const method = String(
      req.method || '',
    ).toUpperCase();

    const path = this.getRequestPath(req);

    // =======================================================
    // AUTH ROUTES
    // =======================================================

    if (path === '/auth/login') {
      return this.getIpAndAccount(
        ip,
        req.body?.mobileNumber,
      );
    }

    if (path === '/auth/register') {
      // Register is intentionally IP-only.
      return `ip:${ip}`;
    }

    if (
      path === '/auth/verify-login-otp'
    ) {
      return this.getIpAndAccount(
        ip,
        req.body?.mobileNumber,
      );
    }

    if (
      path === '/auth/verify-register-otp'
    ) {
      return this.getIpAndAccount(
        ip,
        req.body?.mobileNumber,
      );
    }

    if (path === '/auth/resend-otp') {
      return this.getIpAndAccount(
        ip,
        req.body?.mobileNumber,
      );
    }

    if (
      path === '/auth/forgot-password'
    ) {
      return this.getIpAndAccount(
        ip,
        req.body?.mobileNumber,
      );
    }

    if (
      path ===
      '/auth/verify-forgot-password-otp'
    ) {
      return this.getIpAndAccount(
        ip,
        req.body?.mobileNumber,
      );
    }

    // =======================================================
    // RESET PASSWORD
    // Account + IP protection
    // =======================================================

    if (
      path === '/auth/reset-password'
    ) {
      return this.getResetPasswordTracker(
        ip,
        req.body?.resetToken,
      );
    }

    // =======================================================
    // CHANGE PASSWORD
    // userId
    // =======================================================

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

    // =======================================================
    // USERNAME CHECK
    // Authenticated → userId
    // Unauthenticated → IP
    // =======================================================

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

    // =======================================================
    // AUTHENTICATED APPLICATION APIs
    // =======================================================

    const userId =
      await this.getAuthenticatedUserId(
        req,
      );

    if (userId) {
      return `user:${userId}`;
    }

    // =======================================================
    // PUBLIC / GENERAL APIs
    // =======================================================

    return `ip:${ip}`;
  }

  // =========================================================
  // GET IP ADDRESS
  // =========================================================

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

  // =========================================================
  // GET REQUEST PATH
  // =========================================================

  private getRequestPath(
    req: Record<string, any>,
  ): string {
    return String(
      req.path ||
        req.url?.split('?')[0] ||
        '',
    ).replace(/^\/api/, '');
  }

  // =========================================================
  // IP + ACCOUNT
  // =========================================================

  private getIpAndAccount(
    ip: string,
    account: unknown,
  ): string {
    const normalizedAccount =
      this.normalizeAccount(account);

    if (!normalizedAccount) {
      return `ip:${ip}`;
    }

    return `ip:${ip}:account:${normalizedAccount}`;
  }

  // =========================================================
  // NORMALIZE ACCOUNT
  // =========================================================

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

  // =========================================================
  // GET AUTHENTICATED USER ID
  // =========================================================

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
      authorization.substring(7).trim();

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

  // =========================================================
  // RESET PASSWORD TRACKER
  // =========================================================

  private async getResetPasswordTracker(
    ip: string,
    resetToken: unknown,
  ): Promise<string> {
    const token =
      resetToken === undefined ||
      resetToken === null
        ? ''
        : String(resetToken).trim();

    // Invalid/missing token:
    // protect using IP.
    if (!token) {
      return `ip:${ip}`;
    }

    try {
      const {
        data: tokenData,
        error,
      } = await supabase
        .from('password_reset_tokens')
        .select('mobile_number, expires_at')
        .eq('token', token)
        .maybeSingle();

      if (
        error ||
        !tokenData
      ) {
        // Unknown token → IP protection
        return `ip:${ip}`;
      }

      // Expired token → IP protection
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
      // Never allow throttler lookup failure
      // to break the application.
      return `ip:${ip}`;
    }
  }
}