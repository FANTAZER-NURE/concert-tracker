import { Body, Controller, Get, Post } from '@nestjs/common';
import { validateSchema } from '../common/validation/zod';
import { SourcesService } from './sources.service';
import * as sourcesSchema from './sources.schema';

@Controller('sources')
export class SourcesController {
  constructor(private readonly sourcesService: SourcesService) {}

  @Get()
  list() {
    return this.sourcesService.list();
  }

  @Post()
  create(@Body() body: sourcesSchema.CreateSourceInput) {
    const input = validateSchema(sourcesSchema.createSourceSchema, body);

    return this.sourcesService.create(input);
  }
}
