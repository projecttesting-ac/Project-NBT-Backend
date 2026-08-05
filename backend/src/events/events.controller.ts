import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Body } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
  ) {}

  @Post('poster')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('poster', {
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  uploadPoster(
    @CurrentUser() user: any,
    @UploadedFile() file: any,
  ) {
    return this.eventsService.uploadPoster(user.id, file);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  createEvent(
    @CurrentUser() user: any,
@Body() dto: CreateEventDto,
  ) {
    return this.eventsService.create(user.id, dto);
  }
}