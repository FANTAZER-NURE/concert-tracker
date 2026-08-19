import { Module } from '@nestjs/common';
import { ArtistsModule } from '../artists/artists.module';
import { EventsModule } from '../events/events.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TelegramBotService } from './telegram.bot.service';
import { TelegramConversation } from './telegram.conversation';
import { TelegramSessionStore } from './telegram.session';
import { TelegramUserService } from './telegram-user.service';

@Module({
  imports: [ArtistsModule, EventsModule, IngestionModule, SubscriptionsModule],
  providers: [
    TelegramSessionStore,
    TelegramUserService,
    TelegramConversation,
    TelegramBotService,
  ],
})
export class TelegramModule {}
