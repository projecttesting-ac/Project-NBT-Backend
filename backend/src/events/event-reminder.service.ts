import {
  Injectable,
} from '@nestjs/common';

import {
  Cron,
} from '@nestjs/schedule';

import { supabase } from '../config/supabase';

import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EventReminderService {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron('0 */10 * * * *')
  async sendEventReminders() {
    try {
      const tomorrow =
        new Date();

      tomorrow.setDate(
        tomorrow.getDate() + 1,
      );

      const year =
        tomorrow.getFullYear();

      const month =
        String(
          tomorrow.getMonth() + 1,
        ).padStart(2, '0');

      const day =
        String(
          tomorrow.getDate(),
        ).padStart(2, '0');

      const tomorrowDate =
        `${year}-${month}-${day}`;

      const {
        data: events,
        error: eventError,
      } =
        await supabase
          .from('events')
          .select(
            'id, title, event_date, status',
          )
          .eq(
            'status',
            'published',
          )
          .eq(
            'event_date',
            tomorrowDate,
          );

      if (eventError) {
        console.error(
          'Event reminder lookup failed:',
          eventError.message,
        );

        return;
      }

      if (
        !events ||
        events.length === 0
      ) {
        return;
      }

      for (const event of events) {
        const {
          data: attendees,
          error: attendeeError,
        } =
          await supabase
            .from('event_attendees')
            .select('user_id')
            .eq(
              'event_id',
              event.id,
            );

        if (attendeeError) {
          console.error(
            `Attendee lookup failed for event ${event.id}:`,
            attendeeError.message,
          );

          continue;
        }

        if (
          !attendees ||
          attendees.length === 0
        ) {
          continue;
        }

        for (
          const attendee of attendees
        ) {
          const {
            data: existingLog,
            error: logError,
          } =
            await supabase
              .from(
                'event_notification_logs',
              )
              .select('id')
              .eq(
                'event_id',
                event.id,
              )
              .eq(
                'user_id',
                attendee.user_id,
              )
              .eq(
                'notification_type',
                'EVENT_REMINDER',
              )
              .maybeSingle();

          if (logError) {
            console.error(
              'Reminder log lookup failed:',
              logError.message,
            );

            continue;
          }

          if (existingLog) {
            continue;
          }

          const notification =
            await this.notificationsService.tryCreateNotification(
              attendee.user_id,
              'EVENT_REMINDER',
              'Event reminder',
              `Reminder: "${event.title}" is happening tomorrow.`,
              undefined,
              event.id,
              'EVENT',
            );

          if (!notification) {
            continue;
          }

          const {
            error: insertLogError,
          } =
            await supabase
              .from(
                'event_notification_logs',
              )
              .insert({
                event_id:
                  event.id,

                user_id:
                  attendee.user_id,

                notification_type:
                  'EVENT_REMINDER',
              });

          if (insertLogError) {
            console.error(
              'Event reminder log creation failed:',
              insertLogError.message,
            );
          }
        }
      }
    } catch (error) {
      console.error(
        'Event reminder scheduler failed:',
        error instanceof Error
          ? error.message
          : error,
      );
    }
  }
}