import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { Throttle } from '@nestjs/throttler';

import { FileInterceptor } from '@nestjs/platform-express';

import { UpdateEventDto } from './dto/update-event.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventStatusDto } from './dto/update-event-status.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 20,
      ttl: 60 * 1000,
    },
  })
  @Post('poster')
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
    // upload the event poster
    return this.eventsService.uploadPoster(
      user.id,
      file,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 20,
      ttl: 60 * 1000,
    },
  })
  @Post()
  createEvent(
    @CurrentUser() user: any,
    @Body() dto: CreateEventDto,
  ) {
    // create a new event
    return this.eventsService.create(
      user.id,
      dto,
    );
  }

  @Throttle({
    default: {
      limit: 20,
      ttl: 60 * 1000,
    },
  })
  @Get()
  getAllEvents(
    @Query() pagination: PaginationDto,
  ) {
    // get events with pagination
    return this.eventsService.findAll(
      pagination,
    );
  }

  @Throttle({
    default: {
      limit: 20,
      ttl: 60 * 1000,
    },
  })
  @Get(':id')
  getEventById(
    @Param('id') id: string,
  ) {
    // get a single event
    return this.eventsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 20,
      ttl: 60 * 1000,
    },
  })
  @Patch(':id')
  updateEvent(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
  ) {
    // update event details
    return this.eventsService.update(
      user.id,
      id,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 20,
      ttl: 60 * 1000,
    },
  })
  @Delete(':id')
  deleteEvent(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    // delete the event
    return this.eventsService.remove(
      user.id,
      id,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: 20,
      ttl: 60 * 1000,
    },
  })
  @Patch(':id/status')
  updateEventStatus(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateEventStatusDto,
  ) {
    // change the event status
    return this.eventsService.updateStatus(
      user.id,
      id,
      dto.status,
    );
  }
}