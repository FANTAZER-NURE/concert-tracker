import { Module } from '@nestjs/common';
import { TicketmasterModule } from '../ingestion/ticketmaster/ticketmaster.module';
import { SourcesModule } from '../sources/sources.module';
import { ArtistOnboardingService } from './artist-onboarding.service';
import { ArtistsController } from './artists.controller';
import { ArtistsService } from './artists.service';

@Module({
  imports: [SourcesModule, TicketmasterModule],
  controllers: [ArtistsController],
  providers: [ArtistsService, ArtistOnboardingService],
  exports: [ArtistsService, ArtistOnboardingService],
})
export class ArtistsModule {}
