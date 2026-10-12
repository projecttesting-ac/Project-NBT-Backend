import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { supabase } from '../config/supabase';

@Injectable()
export class UsersService {
  private convertDateOfBirth(
    dateOfBirth?: string,
  ): string | undefined {
    if (dateOfBirth === undefined || dateOfBirth === null) {
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

    if (
      date.getFullYear() !== yearNumber ||
      date.getMonth() !== monthNumber - 1 ||
      date.getDate() !== dayNumber
    ) {
      throw new BadRequestException('Invalid date of birth.');
    }

    const today = new Date();

    let age = today.getFullYear() - yearNumber;

    const birthdayThisYear = new Date(
      today.getFullYear(),
      monthNumber - 1,
      dayNumber,
    );

    if (today < birthdayThisYear) {
      age--;
    }

    if (age < 18) {
      throw new BadRequestException(
        'You must be at least 18 years old to join NBT.',
      );
    }

    return `${year}-${month}-${day}`;
  }

  private normalizeAvatarUrl(
    avatarUrl?: string | null,
  ): string | null {
    if (avatarUrl === undefined || avatarUrl === null) {
      return null;
    }

    const normalized = avatarUrl.trim();

    if (
      normalized === '' ||
      normalized.toLowerCase() === 'null'
    ) {
      return null;
    }

    return normalized;
  }

  private validateCoordinates(
    latitude?: number | null,
    longitude?: number | null,
  ): void {
    if (latitude !== undefined && latitude !== null) {
      if (
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90
      ) {
        throw new BadRequestException(
          'Latitude must be between -90 and 90.',
        );
      }
    }

    if (longitude !== undefined && longitude !== null) {
      if (
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
      ) {
        throw new BadRequestException(
          'Longitude must be between -180 and 180.',
        );
      }
    }
  }

  private removePasswordHash<
    T extends { password_hash?: unknown },
  >(user: T): Omit<T, 'password_hash'> {
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }

  async createProfile(
    userId: string,
    dto: CreateProfileDto,
  ) {
    const {
      data: existingProfile,
      error: profileError,
    } = await supabase
      .from('users')
      .select('id, is_profile_completed')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      throw new BadRequestException(profileError.message);
    }

    if (!existingProfile) {
      throw new NotFoundException('User not found.');
    }

    if (existingProfile.is_profile_completed === true) {
      throw new ConflictException('Profile already created.');
    }

    const normalizedUsername = dto.username.trim().toLowerCase();

    const {
      data: existingUser,
      error: usernameError,
    } = await supabase
      .from('users')
      .select('id')
      .eq('username', normalizedUsername)
      .maybeSingle();

    if (usernameError) {
      throw new BadRequestException(usernameError.message);
    }

    if (existingUser && existingUser.id !== userId) {
      throw new ConflictException('Username already taken.');
    }

    this.validateCoordinates(dto.latitude, dto.longitude);

    const updateValues = {
      username: normalizedUsername,
      display_name: dto.displayName,
      bio: dto.bio,
      interest: dto.interest,
      pronouns: dto.pronouns,
      date_of_birth: this.convertDateOfBirth(dto.dateOfBirth),
      city: dto.city,
      avatar_url: this.normalizeAvatarUrl(dto.avatarUrl),
      cover_image_url: this.normalizeAvatarUrl(dto.coverImageUrl),
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      is_profile_completed: true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('users')
      .update(updateValues)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }

    return {
      success: true,
      message: 'Profile created successfully.',
      user: this.removePasswordHash(data),
    };
  }

  async getMe(userId: string) {
    const {
      data: user,
      error,
    } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return {
      success: true,
      user: this.removePasswordHash(user),
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
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('users')
      .update({
        is_online: false,
        last_seen: now,
        updated_at: now,
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
  const updates: Record<string, unknown> = {};

  if (dto.username !== undefined) {
    const normalizedUsername = dto.username.trim().toLowerCase();

    const {
      data: existingUser,
      error: usernameError,
    } = await supabase
      .from('users')
      .select('id')
      .eq('username', normalizedUsername)
      .maybeSingle();

    if (usernameError) {
      throw new BadRequestException(usernameError.message);
    }

    if (existingUser && existingUser.id !== userId) {
      throw new ConflictException('Username already taken.');
    }

    updates.username = normalizedUsername;
  }

  this.validateCoordinates(dto.latitude, dto.longitude);

  if (dto.displayName !== undefined) {
    updates.display_name = dto.displayName;
  }

  if (dto.bio !== undefined) {
    updates.bio = dto.bio;
  }

  if (dto.city !== undefined) {
    updates.city = dto.city;
  }

  if (dto.interest !== undefined) {
    updates.interest = dto.interest;
  }

  if (dto.pronouns !== undefined) {
    updates.pronouns = dto.pronouns;
  }

  if (dto.dateOfBirth !== undefined) {
    updates.date_of_birth = this.convertDateOfBirth(
      dto.dateOfBirth,
    );
  }

  if (dto.avatarUrl !== undefined) {
    updates.avatar_url = this.normalizeAvatarUrl(
      dto.avatarUrl,
    );
  }

  if (dto.coverImageUrl !== undefined) {
    updates.cover_image_url = this.normalizeAvatarUrl(
      dto.coverImageUrl,
    );
  }

  if (dto.latitude !== undefined) {
    updates.latitude = dto.latitude;
  }

  if (dto.longitude !== undefined) {
    updates.longitude = dto.longitude;
  }

  if (Object.keys(updates).length === 0) {
    throw new BadRequestException(
      'At least one profile field must be provided.',
    );
  }

  // Verify that the user exists before attempting the update.
  const {
    data: existingProfile,
    error: profileCheckError,
  } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (profileCheckError) {
    throw new BadRequestException(profileCheckError.message);
  }

  if (!existingProfile) {
    throw new NotFoundException('User not found.');
  }

  updates.updated_at = new Date().toISOString();

  // Perform the database update only after validation succeeds.
  const { error: updateError } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId);

  if (updateError) {
    throw new BadRequestException(updateError.message);
  }

  // Return success only when Supabase reports no update error.
  return {
    success: true,
    message: 'Profile updated successfully.',
  };
}

  async checkUsername(username: string) {
    const normalizedUsername = username.trim().toLowerCase();

    if (!normalizedUsername) {
      throw new BadRequestException('Username is required.');
    }

    const {
      data,
      error,
    } = await supabase
      .from('users')
      .select('id')
      .eq('username', normalizedUsername)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }

    return {
      success: true,
      available: !data,
    };
  }

  async uploadAvatar(
    userId: string,
    file: any,
  ) {
    if (!file?.buffer || !file?.originalname || !file?.mimetype) {
      throw new BadRequestException('Avatar file is required.');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed.');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException(
        'Avatar image must not exceed 5 MB.',
      );
    }

    const fileExt = file.originalname.split('.').pop()?.toLowerCase();

    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

    if (!fileExt || !allowedExtensions.includes(fileExt)) {
      throw new BadRequestException(
        'Supported formats are JPG, JPEG, PNG, WEBP, and GIF.',
      );
    }

    const fileName = `${userId}-${randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      throw new BadRequestException(uploadError.message);
    }

    const {
      data: { publicUrl },
    } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    const {
      data: updatedUser,
      error: updateError,
    } = await supabase
      .from('users')
      .update({
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('id')
      .maybeSingle();

    if (updateError) {
      throw new BadRequestException(updateError.message);
    }

    if (!updatedUser) {
      throw new NotFoundException('User not found.');
    }

    return {
      success: true,
      message: 'Avatar uploaded successfully.',
      avatarUrl: publicUrl,
    };
  }

  async resolveQrProfile(qrId: string) {
    if (!qrId?.trim()) {
      throw new BadRequestException('QR ID is required.');
    }

    const {
      data: user,
      error,
    } = await supabase
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
        cover_image_url,
        is_online,
        last_seen
      `)
      .eq('qr_id', qrId)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }

    if (!user) {
      throw new NotFoundException('Invalid or expired QR code.');
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
        coverImageUrl: user.cover_image_url,
        isOnline: user.is_online,
        lastSeen: user.last_seen,
      },
    };
  }

  async getMyQr(userId: string) {
    const {
      data: user,
      error,
    } = await supabase
      .from('users')
      .select('id, qr_id, username, display_name')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }

    if (!user) {
      throw new NotFoundException('User not found.');
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
        qrData: user.qr_id,
        username: user.username,
        displayName: user.display_name,
      },
    };
  }
}