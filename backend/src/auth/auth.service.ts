import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { supabase } from '../config/supabase';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async register(registerDto: RegisterDto) {
    const {
      fullName,
      username,
      email,
      password,
      confirmPassword,
    } = registerDto;

    if (password !== confirmPassword) {
      throw new BadRequestException(
        'Password and Confirm Password do not match.',
      );
    }

    // Check email
    const { data: emailUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (emailUser) {
      throw new ConflictException('Email already exists.');
    }

    // Check username
    const { data: usernameUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (usernameUser) {
      throw new ConflictException('Username already exists.');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Insert user
    const { data, error } = await supabase
      .from('users')
      .insert({
        full_name: fullName,
        username,
        email,
        password_hash: passwordHash,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }

    return {
      success: true,
      message: 'Account created successfully.',
      user: {
        id: data.id,
        fullName: data.full_name,
        username: data.username,
        email: data.email,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const { emailOrUsername, password } = loginDto;

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .or(`email.eq.${emailOrUsername},username.eq.${emailOrUsername}`)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const token = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      username: user.username,
    });

    return {
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        username: user.username,
        email: user.email,
      },
    };
  }
}