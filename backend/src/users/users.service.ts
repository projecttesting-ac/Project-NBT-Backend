import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { CreateProfileDto } from './dto/create-profile.dto';
import { supabase } from '../config/supabase';

@Injectable()
export class UsersService {
  async createProfile(userId: string, dto: CreateProfileDto) {
    const {
      fullName,
      username,
      displayName,
      bio,
      interest,
      pronouns,
      dateOfBirth,
      city,
      avatarUrl,
    } = dto;

    // Check if username is already taken by another user
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (checkError) {
      throw new BadRequestException(checkError.message);
    }

    if (existingUser && existingUser.id !== userId) {
      throw new ConflictException('Username already taken.');
    }

    // Update authenticated user
    const { data, error } = await supabase
      .from('users')
      .update({
        full_name: fullName,
        username,
        display_name: displayName,
        bio,
        interest,
        pronouns,
        date_of_birth: dateOfBirth,
        city,
        avatar_url: avatarUrl,
        is_profile_completed: true,
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }

    const { password_hash, ...safeUser } = data;

    return {
      success: true,
      message: 'Profile created successfully.',
      user: safeUser,
    };
  }
  async getMe(userId: string) {
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !user) {
    throw new BadRequestException('User not found.');
  }

  const { password_hash, ...safeUser } = user;

  return {
    success: true,
    user: safeUser,
  };
}
}