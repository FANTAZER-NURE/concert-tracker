import { Injectable } from '@nestjs/common';
import type { TicketmasterAttraction } from '../ingestion/ticketmaster/ticketmaster.client';

export type TelegramSession =
  | { step: 'awaiting_name' }
  | { step: 'tm_choices'; attractions: TicketmasterAttraction[] };

@Injectable()
export class TelegramSessionStore {
  private readonly sessions = new Map<string, TelegramSession>();

  get(telegramId: string) {
    return this.sessions.get(telegramId);
  }

  set(telegramId: string, session: TelegramSession) {
    this.sessions.set(telegramId, session);
  }

  clear(telegramId: string) {
    this.sessions.delete(telegramId);
  }
}
