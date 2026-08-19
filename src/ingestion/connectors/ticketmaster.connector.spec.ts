import { TicketmasterClient } from '../ticketmaster/ticketmaster.client';
import { TicketmasterConnector } from './ticketmaster.connector';

const ticketmasterSource = {
  type: 'EVENT_API',
  name: 'Ticketmaster',
  externalId: 'K8vZ9171oZ7',
  url: null,
  artistId: 'artist-1',
};

describe('TicketmasterConnector', () => {
  it('handles Ticketmaster EVENT_API sources with an externalId', () => {
    const connector = new TicketmasterConnector();

    expect(connector.canHandle(ticketmasterSource)).toBe(true);
  });

  it('rejects sources missing an externalId', () => {
    const connector = new TicketmasterConnector();

    expect(
      connector.canHandle({ ...ticketmasterSource, externalId: null }),
    ).toBe(false);
  });

  it('rejects non-Ticketmaster sources', () => {
    const connector = new TicketmasterConnector();

    expect(connector.canHandle({ ...ticketmasterSource, name: 'Songkick' })).toBe(
      false,
    );
    expect(
      connector.canHandle({ ...ticketmasterSource, type: 'SOCIAL' }),
    ).toBe(false);
  });

  it('fetches events through TicketmasterClient', async () => {
    const items = [{ externalId: 'evt-1', url: 'https://tm.example', title: 'Show' }];
    const tmClient = {
      getAllAttractionEvents: jest.fn().mockResolvedValue(items),
    } as unknown as TicketmasterClient;
    const connector = new TicketmasterConnector(tmClient);

    await expect(connector.fetch(ticketmasterSource)).resolves.toEqual(items);
    expect(tmClient.getAllAttractionEvents).toHaveBeenCalledWith('K8vZ9171oZ7');
  });

  it('returns no items when the client is missing', async () => {
    const connector = new TicketmasterConnector();

    await expect(connector.fetch(ticketmasterSource)).resolves.toEqual([]);
  });
});
