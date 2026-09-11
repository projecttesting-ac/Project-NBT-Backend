import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { supabase } from '../config/supabase';
import { UpdateProfileDto } from './dto/update-profile.dto';
@Injectable()
export class UsersService {
  private convertDateOfBirth(
  dateOfBirth?: string,
): string | undefined {
  if (!dateOfBirth) {
    return undefined;
  }

  const parts = dateOfBirth.split('/');

  if (parts.length !== 3) {
    throw new BadRequestException(
      'Date of birth must be in DD/MM/YYYY format.',
    );
  }

  const [day, month, year] = parts;

  if (
    !/^\d{2}$/.test(day) ||
    !/^\d{2}$/.test(month) ||
    !/^\d{4}$/.test(year)
  ) {
    throw new BadRequestException(
      'Date of birth must be in DD/MM/YYYY format.',
    );
  }

  const dayNumber = Number(day);
  const monthNumber = Number(month);
  const yearNumber = Number(year);

  const date = new Date(
    yearNumber,
    monthNumber - 1,
    dayNumber,
  );

  // Check if the date is actually valid
  if (
    date.getFullYear() !== yearNumber ||
    date.getMonth() !== monthNumber - 1 ||
    date.getDate() !== dayNumber
  ) {
    throw new BadRequestException(
      'Invalid date of birth.',
    );
  }

  // Only allow DOB years from 1990 to 2012
  if (yearNumber < 1990 || yearNumber > 2012) {
    throw new BadRequestException(
  'You must be at least 14 years old.',
);
  }

  return `${year}-${month}-${day}`;
}
  async createProfile(userId: string, dto: CreateProfileDto) {

  // Check if user already has a completed profile
  
  const { data: existingProfile, error: profileError } =
    await supabase
      .from('users')
      .select('is_profile_completed')
      .eq('id', userId)
      .single();

  if (profileError || !existingProfile) {
    throw new BadRequestException('User not found.');
  }

  if (existingProfile.is_profile_completed === true) {
    throw new ConflictException('Profile already created.');
  }

  const {
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
  const { data: existingUser, error: checkError } =
    await supabase
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

  // Create profile
  const { data, error } = await supabase
    .from('users')
    .update({
      username,
      display_name: displayName,
      bio,
      interest,
      pronouns,
      date_of_birth: this.convertDateOfBirth(dateOfBirth),
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
async setOnline(userId: string) {
  const { error } = await supabase
    .from('users')
    .update({
      is_online: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    throw new BadRequestException(error.message);
  }

  return {
    success: true,
    message: 'User is online.',
  };
}

async setOffline(userId: string) {
  const { error } = await supabase
    .from('users')
    .update({
      is_online: false,
      last_seen: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    throw new BadRequestException(error.message);
  }

  return {
    success: true,
    message: 'User is offline.',
  };
}
async updateProfile(
  userId: string,
  dto: UpdateProfileDto,
) {
  if (dto.username) {
  const normalizedUsername = dto.username.trim().toLowerCase();

  const { data: existingUser, error: checkError } = await supabase
    .from('users')
    .select('id')
    .eq('username', normalizedUsername)
    .maybeSingle();

  if (checkError) {
    throw new BadRequestException(checkError.message);
  }

  if (existingUser && existingUser.id !== userId) {
    throw new ConflictException('Username already taken.');
  }

  dto.username = normalizedUsername;
}
  const updates: Record<string, any> = {};

if (dto.displayName !== undefined)
  updates.display_name = dto.displayName;

if (dto.username !== undefined)
  updates.username = dto.username;

if (dto.bio !== undefined)
  updates.bio = dto.bio;

if (dto.city !== undefined)
  updates.city = dto.city;

if (dto.interest !== undefined)
  updates.interest = dto.interest;

if (dto.pronouns !== undefined)
  updates.pronouns = dto.pronouns;

if (dto.dateOfBirth !== undefined)
  updates.date_of_birth =
    this.convertDateOfBirth(dto.dateOfBirth);

if (dto.avatarUrl !== undefined)
  updates.avatar_url = dto.avatarUrl;

updates.updated_at = new Date().toISOString();

const { error } = await supabase
  .from('users')
  .update(updates)
  .eq('id', userId);

  if (error) {
    throw new BadRequestException(error.message);
  }

  return {
    success: true,
    message: 'Profile updated successfully.',
  };
}
async checkUsername(username: string) {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (error) {
    throw new BadRequestException(error.message);
  }

  return {
    success: true,
    available: !data,
  };
}
async uploadAvatar(userId: string, file: any) {
  if (!file) {
    throw new BadRequestException('Avatar file is required.');
  }

  const fileExt = file.originalname.split('.').pop();
  const fileName = `${userId}-${randomUUID()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (uploadError) {
    throw new BadRequestException(uploadError.message);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('avatars').getPublicUrl(fileName);

  const { error: updateError } = await supabase
    .from('users')
    .update({
      avatar_url: publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (updateError) {
    throw new BadRequestException(updateError.message);
  }

  return {
    success: true,
    message: 'Avatar uploaded successfully.',
    avatarUrl: publicUrl,
  };
}
async resolveQrProfile(qrId: string) {
  if (!qrId) {
    throw new BadRequestException('QR ID is required.');
  }

  const { data: user, error } = await supabase
    .from('users')
    .select(`
      id,
      qr_id,
      username,
      display_name,
      bio,
      interest,
      pronouns,
      city,
      avatar_url,
      profile_image,
      is_online,
      last_seen
    `)
    .eq('qr_id', qrId)
    .maybeSingle();

  if (error) {
    throw new BadRequestException(error.message);
  }

  if (!user) {
    throw new BadRequestException('Invalid or expired QR code.');
  }

  return {
    success: true,
    user: {
      id: user.id,
      qrId: user.qr_id,
      username: user.username,
      displayName: user.display_name,
      bio: user.bio,
      interest: user.interest,
      pronouns: user.pronouns,
      city: user.city,
      avatarUrl: user.avatar_url ?? user.profile_image,
      isOnline: user.is_online,
      lastSeen: user.last_seen,
    },
  };
}
async getMyQr(userId: string) {
  const { data: user, error } = await supabase
    .from('users')
    .select(`
      id,
      qr_id,
      username,
      display_name
    `)
    .eq('id', userId)
    .single();

  if (error || !user) {
    throw new BadRequestException('User not found.');
  }

  if (!user.qr_id) {
    throw new BadRequestException(
      'QR ID has not been generated for this user.',
    );
  }

  return {
    success: true,
    message: 'QR data generated successfully.',
    data: {
      qrId: user.qr_id,

      // This is what the frontend puts inside the QR code.
      qrData: user.qr_id,

      username: user.username,
      displayName: user.display_name,
    },
  };
}
}