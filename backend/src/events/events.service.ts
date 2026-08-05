import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { randomUUID } from 'crypto';

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
}