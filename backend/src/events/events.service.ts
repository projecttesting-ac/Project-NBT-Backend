import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { randomUUID } from 'crypto';
import { UpdateEventDto } from './dto/update-event.dto';
import { supabase } from '../config/supabase';

@Injectable()
export class EventsService {
  async uploadPoster(
    userId: string,
    file: any,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Poster file is required.',
      );
    }

    const fileExt = file.originalname
      .split('.')
      .pop();

    const fileName = `${userId}-${randomUUID()}.${fileExt}`;

    const { error: uploadError } =
      await supabase.storage
        .from('event-posters')
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

    if (uploadError) {
      throw new BadRequestException(
        uploadError.message,
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage
      .from('event-posters')
      .getPublicUrl(fileName);

    return {
      success: true,
      message: 'Poster uploaded successfully.',
      posterUrl: publicUrl,
    };
  }
  async create(
  userId: string,
  dto: CreateEventDto,
) {
  const { data, error } = await supabase
    .from('events')
    .insert({
organizer_id: userId,
      title: dto.title,
      description: dto.description,
      what_to_expect: dto.whatToExpect,
      organizer_note: dto.organizerNote,
      event_date: dto.eventDate,
      venue_name: dto.venueName,
      venue_address: dto.venueAddress,
      poster_url: dto.posterUrl,
      latitude: dto.latitude,
      longitude: dto.longitude,
    })
    .select()
    .single();

  if (error) {
    throw new BadRequestException(error.message);
  }

  return {
    success: true,
    message: 'Event created successfully.',
    event: data,
  };
}
async findAll() {
  const { data, error } = await supabase
  .from('events')
  .select('*')
  .order('event_date', { ascending: true });
  if (error) {
    throw new BadRequestException(error.message);
  }

  return {
    success: true,
    events: data,
  };
}
async findOne(id: string) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    throw new BadRequestException(error.message);
  }

  return {
    success: true,
    event: data,
  };
}
async update(
  userId: string,
  eventId: string,
  dto: UpdateEventDto,
) {
  // Check if the event exists
  const { data: event, error: findError } = await supabase
    .from('events')
    .select('organizer_id')
    .eq('id', eventId)
    .single();

  if (findError || !event) {
    throw new BadRequestException('Event not found.');
  }

  // Only the organizer can update
  if (event.organizer_id !== userId) {
    throw new BadRequestException(
      'You are not allowed to update this event.',
    );
  }

  const updates: Record<string, any> = {};

  if (dto.title !== undefined)
    updates.title = dto.title;

  if (dto.description !== undefined)
    updates.description = dto.description;

  if (dto.whatToExpect !== undefined)
    updates.what_to_expect = dto.whatToExpect;

  if (dto.organizerNote !== undefined)
    updates.organizer_note = dto.organizerNote;

  if (dto.eventDate !== undefined)
    updates.event_date = dto.eventDate;

  if (dto.venueName !== undefined)
    updates.venue_name = dto.venueName;

  if (dto.venueAddress !== undefined)
    updates.venue_address = dto.venueAddress;

  if (dto.posterUrl !== undefined)
    updates.poster_url = dto.posterUrl;

  if (dto.latitude !== undefined)
    updates.latitude = dto.latitude;

  if (dto.longitude !== undefined)
    updates.longitude = dto.longitude;

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', eventId)
    .select()
    .single();

  if (error) {
    throw new BadRequestException(error.message);
  }

  return {
    success: true,
    message: 'Event updated successfully.',
    event: data,
  };
}
async remove(
  userId: string,
  eventId: string,
) {
  // Check if the event exists
  const { data: event, error: findError } = await supabase
    .from('events')
    .select('organizer_id')
    .eq('id', eventId)
    .single();

  if (findError || !event) {
    throw new BadRequestException(
      'Event not found.',
    );
  }

  // Only the organizer can delete
  if (event.organizer_id !== userId) {
    throw new BadRequestException(
      'You are not allowed to delete this event.',
    );
  }

  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);

  if (error) {
    throw new BadRequestException(error.message);
  }

  return {
    success: true,
    message: 'Event deleted successfully.',
  };
}
async updateStatus(
  userId: string,
  eventId: string,
  status: 'draft' | 'published',
) {
  // Verify event exists
  const { data: event, error: findError } = await supabase
    .from('events')
    .select('organizer_id')
    .eq('id', eventId)
    .single();

  if (findError || !event) {
    throw new BadRequestException('Event not found.');
  }

  // Verify ownership
  if (event.organizer_id !== userId) {
    throw new BadRequestException(
      'You are not allowed to update this event.',
    );
  }

  const { data, error } = await supabase
    .from('events')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .select()
    .single();

  if (error) {
    throw new BadRequestException(error.message);
  }

  return {
    success: true,
    message: `Event ${status} successfully.`,
    event: data,
  };
}
}