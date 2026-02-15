import { Body, Controller, Get, Post } from '@nestjs/common';
import { validateSchema } from '../common/validation/zod';
import { EventsService } from './events.service';
import * as eventsSchema from './events.schema';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  list() {
    return this.eventsService.list();
  }

  @Post()
  create(@Body() body: eventsSchema.CreateEventInput) {
    const input = validateSchema(eventsSchema.createEventSchema, body);

    return this.eventsService.create(input);
  }
}
