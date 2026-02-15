import { Body, Controller, Get, Post } from '@nestjs/common';
import { validateSchema } from '../common/validation/zod';
import { ArtistsService } from './artists.service';
import * as artistsSchema from './artists.schema';

@Controller('artists')
export class ArtistsController {
  constructor(private readonly artistsService: ArtistsService) {}

  @Get()
  list() {
    return this.artistsService.list();
  }

  @Post()
  create(@Body() body: artistsSchema.CreateArtistInput) {
    const input = validateSchema(artistsSchema.createArtistSchema, body);

    return this.artistsService.create(input);
  }
}
