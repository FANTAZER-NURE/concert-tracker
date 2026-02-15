import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [ScheduleModule.forRoot()],
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
  ],
})
export class IngestionModule {}
