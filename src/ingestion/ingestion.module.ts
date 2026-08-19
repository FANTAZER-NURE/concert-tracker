import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsModule } from '../notifications/notifications.module';
import { SOURCE_CONNECTORS } from './connectors/source-connector';
import { TicketmasterConnector } from './connectors/ticketmaster.connector';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { TICKETMASTER_CLIENT } from './ticketmaster/ticketmaster.constants';
import { TicketmasterClient } from './ticketmaster/ticketmaster.client';
import { TicketmasterModule } from './ticketmaster/ticketmaster.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    HttpModule,
    NotificationsModule,
    TicketmasterModule,
  ],
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
      provide: TicketmasterConnector,
      useFactory: (ticketmasterClient?: TicketmasterClient) =>
        new TicketmasterConnector(ticketmasterClient),
      inject: [TICKETMASTER_CLIENT],
    },
    {
      provide: SOURCE_CONNECTORS,
      useFactory: (ticketmasterConnector: TicketmasterConnector) => [
        ticketmasterConnector,
      ],
      inject: [TicketmasterConnector],
    },
  ],
  exports: [IngestionService],
})
export class IngestionModule {}
