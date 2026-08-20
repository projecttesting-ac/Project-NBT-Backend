import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';

import { UpdateEventDto } from './dto/update-event.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { Body } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EventsService } from './events.service';
import { UpdateEventStatusDto } from './dto/update-event-status.dto';
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
  @Get()
getAllEvents() {
  return this.eventsService.findAll();
}
@Get(':id')
getEventById(
  @Param('id') id: string,
) {
  return this.eventsService.findOne(id);
}
@UseGuards(JwtAuthGuard)
@Patch(':id')
updateEvent(
  @CurrentUser() user: any,
  @Param('id') id: string,
  @Body() dto: UpdateEventDto,
) {
  return this.eventsService.update(user.id, id, dto);
}
@UseGuards(JwtAuthGuard)
@Delete(':id')
deleteEvent(
  @CurrentUser() user: any,
  @Param('id') id: string,
) {
  return this.eventsService.remove(user.id, id);
}
@UseGuards(JwtAuthGuard)
@Patch(':id/status')
updateEventStatus(
  @CurrentUser() user: any,
  @Param('id') id: string,
  @Body() dto: UpdateEventStatusDto,
) {
  return this.eventsService.updateStatus(
    user.id,
    id,
    dto.status,
  );
}
}