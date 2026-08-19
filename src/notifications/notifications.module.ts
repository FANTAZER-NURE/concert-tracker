import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MatchingService } from './matching.service';
import { TelegramSender } from './telegram.sender';

@Module({
  imports: [HttpModule],
  providers: [MatchingService, TelegramSender],
  exports: [MatchingService, TelegramSender],
})
export class NotificationsModule {}
