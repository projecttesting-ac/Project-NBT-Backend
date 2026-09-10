import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { supabase } from '../config/supabase';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
    });
  }

  async validate(payload: any) {
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', payload.id)
    .maybeSingle();

  if (error || !user) {
    throw new UnauthorizedException('Invalid token.');
  }

  const { password_hash, ...safeUser } = user;

  return safeUser;
}
}