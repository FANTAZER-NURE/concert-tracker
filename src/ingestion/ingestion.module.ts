import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { TicketmasterClient } from './ticketmaster/ticketmaster.client';

@Module({
  imports: [ScheduleModule.forRoot(), HttpModule],
  controllers: [IngestionController],
  providers: [
    IngestionService,
    {
      provide: 'INGESTION_CONFIG',
      useFactory: (configService: ConfigService) => ({
        pollIntervalMinutes:
          configService.get<number>('POLL_INTERVAL_MINUTES') ?? 60,
      }),
      inject: [ConfigService],
    },
    {
      provide: 'INGESTION_AUTO_SCHEDULE',
      useFactory: (configService: ConfigService) =>
        configService.get<string>('NODE_ENV') !== 'test',
      inject: [ConfigService],
    },
    {
      provide: 'TICKETMASTER_CLIENT',
      useFactory: (configService: ConfigService, httpService: HttpService) => {
        const apiKey = configService.get<string>('TICKETMASTER_API_KEY');
        if (!apiKey) {
          return undefined;
        }
        return new TicketmasterClient(httpService, apiKey);
      },
      inject: [ConfigService, HttpService],
    },
  ],
})
export class IngestionModule {}
