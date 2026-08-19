import { SourceItem } from '../source-item';
import { TicketmasterClient } from '../ticketmaster/ticketmaster.client';
import { ConnectorSource, SourceConnector } from './source-connector';

export class TicketmasterConnector implements SourceConnector {
  constructor(private readonly ticketmasterClient?: TicketmasterClient) {}

  canHandle(source: ConnectorSource): boolean {
    return (
      source.type === 'EVENT_API' &&
      source.name === 'Ticketmaster' &&
      !!source.externalId
    );
  }

  async fetch(source: ConnectorSource): Promise<SourceItem[]> {
    if (!this.ticketmasterClient || !source.externalId) {
      return [];
    }

    return this.ticketmasterClient.getAllAttractionEvents(source.externalId);
  }
}
