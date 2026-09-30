import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { supabase } from '../config/supabase';
import { PaginationDto } from '../common/dto/pagination.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EventsService {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  private convertEventDate(
    eventDate?: string,
  ): string | undefined {
    if (!eventDate) {
      return undefined;
    }

    const parts = eventDate.split('/');

    if (parts.length !== 3) {
      throw new BadRequestException(
        'Event date must be in DD/MM/YYYY format.',
      );
    }

    const [day, month, year] = parts;

    if (
      !/^\d{2}$/.test(day) ||
      !/^\d{2}$/.test(month) ||
      !/^\d{4}$/.test(year)
    ) {
      throw new BadRequestException(
        'Event date must be in DD/MM/YYYY format.',
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
      throw new BadRequestException(
        'Invalid event date.',
      );
    }

    return `${year}-${month}-${day}`;
  }

  private async notifyEventAttendees(
    eventId: string,
    type: string,
    title: string,
    message: string,
    actorId?: string,
  ) {
    const {
      data: attendees,
      error,
    } = await supabase
      .from('event_attendees')
      .select('user_id')
      .eq('event_id', eventId);

    if (error) {
      console.error(
        'Event attendee lookup for notification failed:',
        error.message,
      );

      return;
    }

    if (!attendees || attendees.length === 0) {
      return;
    }

    await Promise.all(
      attendees.map((attendee) =>
        this.notificationsService.tryCreateNotification(
          attendee.user_id,
          type,
          title,
          message,
          actorId,
          eventId,
          'EVENT',
        ),
      ),
    );
  }

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
        event_date: this.convertEventDate(
          dto.eventDate,
        ),
        venue_name: dto.venueName,
        venue_address: dto.venueAddress,
        poster_url: dto.posterUrl,
        latitude: dto.latitude,
        longitude: dto.longitude,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    return {
      success: true,
      message: 'Event created successfully.',
      event: data,
    };
  }

  async findAll(
    pagination: PaginationDto,
  ) {
    const page = pagination.page;
    const limit = pagination.limit;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const {
      data,
      error,
      count,
    } = await supabase
      .from('events')
      .select('*', { count: 'exact' })
      .order('event_date', {
        ascending: true,
      })
      .range(from, to);

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    const events = data ?? [];

    const eventIds = events.map(
      (event) => event.id,
    );

    let attendeeCounts: Record<
      string,
      number
    > = {};

    if (eventIds.length > 0) {
      const {
        data: attendees,
        error: attendeeError,
      } = await supabase
        .from('event_attendees')
        .select('event_id')
        .in('event_id', eventIds);

      if (attendeeError) {
        throw new BadRequestException(
          attendeeError.message,
        );
      }

      attendeeCounts = (attendees ?? []).reduce(
        (
          counts: Record<string, number>,
          attendee,
        ) => {
          counts[attendee.event_id] =
            (counts[attendee.event_id] ?? 0) + 1;

          return counts;
        },
        {},
      );
    }

    const eventsWithCounts = events.map(
      (event) => ({
        ...event,
        attendeeCount:
          attendeeCounts[event.id] ?? 0,
      }),
    );

    const total = count ?? 0;
    const totalPages = Math.ceil(
      total / limit,
    );

    return {
      success: true,
      events: eventsWithCounts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage:
          page < totalPages,
        hasPreviousPage:
          page > 1,
      },
    };
  }

  async findOne(id: string) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new BadRequestException(
        'Event not found.',
      );
    }

    const {
      count,
      error: attendeeError,
    } = await supabase
      .from('event_attendees')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('event_id', id);

    if (attendeeError) {
      throw new BadRequestException(
        attendeeError.message,
      );
    }

    return {
      success: true,
      event: {
        ...data,
        attendeeCount: count ?? 0,
      },
    };
  }

  async rsvpToEvent(
    userId: string,
    eventId: string,
  ) {
    const {
      data: event,
      error: eventError,
    } = await supabase
      .from('events')
      .select('id, status')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      throw new BadRequestException(
        'Event not found.',
      );
    }

    if (event.status !== 'published') {
      throw new BadRequestException(
        'You can only RSVP to a published event.',
      );
    }

    const {
      data: existing,
      error: existingError,
    } = await supabase
      .from('event_attendees')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingError) {
      throw new BadRequestException(
        existingError.message,
      );
    }

    if (existing) {
      return {
        success: true,
        message: 'You have already RSVP’d to this event.',
        isRsvped: true,
      };
    }

    const {
      data,
      error,
    } = await supabase
      .from('event_attendees')
      .insert({
        event_id: eventId,
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    await this.notificationsService.tryCreateNotification(
      userId,
      'RSVP_CONFIRMED',
      'RSVP confirmed',
      'Your RSVP for the event has been confirmed.',
      undefined,
      eventId,
      'EVENT',
    );

    return {
      success: true,
      message: 'RSVP confirmed successfully.',
      isRsvped: true,
      attendee: data,
    };
  }

  async cancelRsvp(
    userId: string,
    eventId: string,
  ) {
    const {
      data: existing,
      error: findError,
    } = await supabase
      .from('event_attendees')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();

    if (findError) {
      throw new BadRequestException(
        findError.message,
      );
    }

    if (!existing) {
      return {
        success: true,
        message: 'You have not RSVP’d to this event.',
        isRsvped: false,
      };
    }

    const { error } = await supabase
      .from('event_attendees')
      .delete()
      .eq('id', existing.id);

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    return {
      success: true,
      message: 'RSVP cancelled successfully.',
      isRsvped: false,
    };
  }

  async getEventAttendees(
    eventId: string,
  ) {
    const {
      data: event,
      error: eventError,
    } = await supabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      throw new BadRequestException(
        'Event not found.',
      );
    }

    const {
      data: attendees,
      error,
    } = await supabase
      .from('event_attendees')
      .select(
        `
        id,
        user_id,
        created_at,
        users:user_id (
          id,
          username,
          display_name,
          avatar_url
        )
        `,
      )
      .eq('event_id', eventId)
      .order('created_at', {
        ascending: true,
      });

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    return {
      success: true,
      attendees: attendees ?? [],
      count: attendees?.length ?? 0,
    };
  }

  async getRsvpStatus(
    userId: string,
    eventId: string,
  ) {
    const {
      data: event,
      error: eventError,
    } = await supabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      throw new BadRequestException(
        'Event not found.',
      );
    }

    const {
      data,
      error,
    } = await supabase
      .from('event_attendees')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    return {
      success: true,
      isRsvped: !!data,
    };
  }

  async update(
    userId: string,
    eventId: string,
    dto: UpdateEventDto,
  ) {
    const {
      data: event,
      error: findError,
    } = await supabase
      .from('events')
      .select('organizer_id')
      .eq('id', eventId)
      .single();

    if (findError || !event) {
      throw new BadRequestException(
        'Event not found.',
      );
    }

    if (event.organizer_id !== userId) {
      throw new BadRequestException(
        'You are not allowed to update this event.',
      );
    }

    const updates: Record<string, any> = {};

    if (dto.title !== undefined)
      updates.title = dto.title;

    if (dto.description !== undefined)
      updates.description =
        dto.description;

    if (dto.whatToExpect !== undefined)
      updates.what_to_expect =
        dto.whatToExpect;

    if (dto.organizerNote !== undefined)
      updates.organizer_note =
        dto.organizerNote;

    if (dto.eventDate !== undefined)
      updates.event_date =
        this.convertEventDate(
          dto.eventDate,
        );

    if (dto.venueName !== undefined)
      updates.venue_name =
        dto.venueName;

    if (dto.venueAddress !== undefined)
      updates.venue_address =
        dto.venueAddress;

    if (dto.posterUrl !== undefined)
      updates.poster_url =
        dto.posterUrl;

    if (dto.latitude !== undefined)
      updates.latitude =
        dto.latitude;

    if (dto.longitude !== undefined)
      updates.longitude =
        dto.longitude;

    updates.updated_at =
      new Date().toISOString();

    const { data, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', eventId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    await this.notifyEventAttendees(
      eventId,
      'EVENT_UPDATE',
      'Event updated',
      'An event you RSVP’d to has been updated.',
      userId,
    );

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
    const {
      data: event,
      error: findError,
    } = await supabase
      .from('events')
      .select('organizer_id')
      .eq('id', eventId)
      .single();

    if (findError || !event) {
      throw new BadRequestException(
        'Event not found.',
      );
    }

    if (event.organizer_id !== userId) {
      throw new BadRequestException(
        'You are not allowed to delete this event.',
      );
    }

    await this.notifyEventAttendees(
      eventId,
      'EVENT_UPDATE',
      'Event cancelled',
      'An event you RSVP’d to has been cancelled.',
      userId,
    );

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId);

    if (error) {
      throw new BadRequestException(
        error.message,
      );
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
    const {
      data: event,
      error: findError,
    } = await supabase
      .from('events')
      .select('organizer_id, status')
      .eq('id', eventId)
      .single();

    if (findError || !event) {
      throw new BadRequestException(
        'Event not found.',
      );
    }

    if (event.organizer_id !== userId) {
      throw new BadRequestException(
        'You are not allowed to update this event.',
      );
    }

    const { data, error } = await supabase
      .from('events')
      .update({
        status,
        updated_at:
          new Date().toISOString(),
      })
      .eq('id', eventId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    if (
      status === 'published' &&
      event.status !== 'published'
    ) {
      await this.notifyEventAttendees(
        eventId,
        'EVENT_UPDATE',
        'Event published',
        'An event you RSVP’d to is now published.',
        userId,
      );
    }

    return {
      success: true,
      message: `Event ${status} successfully.`,
      event: data,
    };
  }
}