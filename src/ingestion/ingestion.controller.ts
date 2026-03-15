import { Controller, Get, Param, Post } from '@nestjs/common';
import { IngestionService } from './ingestion.service';

@Controller('ingestion')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post('run')
  runOnce() {
    return this.ingestionService.runPollOnce();
  }

  @Get('artist/:artistName')
  getArtist(@Param('artistName') artistName: string) {
    return this.ingestionService.getArtist(artistName);
  }
}
