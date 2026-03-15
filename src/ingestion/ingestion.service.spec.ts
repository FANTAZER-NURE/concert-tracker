import { IngestionService } from './ingestion.service';
import { SourceItem } from './source-item';
import { TicketmasterClient } from './ticketmaster/ticketmaster.client';

const fixedNow = new Date('2026-02-01T12:00:00.000Z');

function createPrismaMock(sources: any[] = []) {
  return {
    source: {
      findMany: jest.fn().mockResolvedValue(sources),
    },
    sourceEntry: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'entry-1' }),
    },
    event: {
      create: jest.fn().mockResolvedValue({ id: 'event-1' }),
    },
  };
}

describe('IngestionService', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('generic source polling', () => {
    it('creates SourceEntry and placeholder Event for active source with artist', async () => {
      const source = {
        id: 'source-1',
        artistId: 'artist-1',
        name: 'Instagram',
        type: 'SOCIAL',
        url: 'https://instagram.com/eminem',
        externalId: null,
      };
      const prismaMock = createPrismaMock([source]);
      const service = new IngestionService(
        prismaMock as never,
        { pollIntervalMinutes: 60 },
        true,
      );

      await service.runPollOnce();

      expect(prismaMock.event.create).toHaveBeenCalledWith({
        data: {
          artistId: 'artist-1',
          name: 'Pending event from Instagram',
          confidence: 0.1,
        },
      });
      expect(prismaMock.sourceEntry.create).toHaveBeenCalledWith({
        data: {
          sourceId: 'source-1',
          artistId: 'artist-1',
          eventId: 'event-1',
          url: 'https://instagram.com/eminem',
          externalId: 'poll-2026-02-01',
          title: 'Pending event from Instagram',
        },
      });
    });

    it('skips creation when SourceEntry exists for poll window', async () => {
      const source = {
        id: 'source-1',
        artistId: 'artist-1',
        name: 'Instagram',
        type: 'SOCIAL',
        url: 'https://instagram.com/eminem',
        externalId: null,
      };
      const prismaMock = createPrismaMock([source]);
      prismaMock.sourceEntry.findUnique.mockResolvedValue({ id: 'entry-1' });
      const service = new IngestionService(
        prismaMock as never,
        { pollIntervalMinutes: 60 },
        true,
      );

      await service.runPollOnce();

      expect(prismaMock.event.create).not.toHaveBeenCalled();
      expect(prismaMock.sourceEntry.create).not.toHaveBeenCalled();
    });

    it('creates only SourceEntry when source has no artist', async () => {
      const source = {
        id: 'source-1',
        artistId: null,
        name: 'Songkick',
        type: 'EVENT_API',
        url: 'https://songkick.com',
        externalId: null,
      };
      const prismaMock = createPrismaMock([source]);
      const service = new IngestionService(
        prismaMock as never,
        { pollIntervalMinutes: 60 },
        true,
      );

      await service.runPollOnce();

      expect(prismaMock.event.create).not.toHaveBeenCalled();
      expect(prismaMock.sourceEntry.create).toHaveBeenCalledWith({
        data: {
          sourceId: 'source-1',
          artistId: null,
          eventId: null,
          url: 'https://songkick.com',
          externalId: 'poll-2026-02-01',
          title: 'Pending event from Songkick',
        },
      });
    });
  });

  describe('Ticketmaster source polling', () => {
    const ticketmasterSource = {
      id: 'source-tm',
      artistId: 'artist-1',
      name: 'Ticketmaster',
      type: 'EVENT_API',
      url: null,
      externalId: 'K8vZ9171oZ7',
    };

    const sampleItem: SourceItem = {
      externalId: 'G5diZfkn0B-bh',
      title: 'Eminem Live 2026',
      url: 'https://www.ticketmaster.com/eminem-live-2026',
      ticketUrl: 'https://www.ticketmaster.com/eminem-live-2026',
      startAt: new Date('2026-07-15T19:00:00Z'),
      dateText: '2026-07-15',
      timezone: 'America/New_York',
      city: 'New York',
      country: 'US',
      venueName: 'Madison Square Garden',
      priceMin: 75,
      priceMax: 350,
      currency: 'USD',
    };

    function createTmClient(items: SourceItem[] = [sampleItem]) {
      return {
        getAllAttractionEvents: jest.fn().mockResolvedValue(items),
      } as unknown as TicketmasterClient;
    }

    it('creates Event and SourceEntry from Ticketmaster data', async () => {
      const prismaMock = createPrismaMock([ticketmasterSource]);
      const tmClient = createTmClient();
      const service = new IngestionService(
        prismaMock as never,
        { pollIntervalMinutes: 60 },
        true,
        tmClient,
      );

      await service.runPollOnce();

      expect(tmClient.getAllAttractionEvents).toHaveBeenCalledWith(
        'K8vZ9171oZ7',
      );
      expect(prismaMock.event.create).toHaveBeenCalledWith({
        data: {
          artistId: 'artist-1',
          name: 'Eminem Live 2026',
          startAt: new Date('2026-07-15T19:00:00Z'),
          dateText: '2026-07-15',
          timezone: 'America/New_York',
          city: 'New York',
          country: 'US',
          ticketUrl: 'https://www.ticketmaster.com/eminem-live-2026',
          priceMin: 75,
          priceMax: 350,
          currency: 'USD',
          confidence: 0.9,
        },
      });
      expect(prismaMock.sourceEntry.create).toHaveBeenCalledWith({
        data: {
          sourceId: 'source-tm',
          artistId: 'artist-1',
          eventId: 'event-1',
          url: 'https://www.ticketmaster.com/eminem-live-2026',
          externalId: 'G5diZfkn0B-bh',
          title: 'Eminem Live 2026',
          confidence: 0.9,
        },
      });
    });

    it('skips duplicate Ticketmaster events by externalId', async () => {
      const prismaMock = createPrismaMock([ticketmasterSource]);
      prismaMock.sourceEntry.findUnique.mockResolvedValue({ id: 'existing' });
      const tmClient = createTmClient();
      const service = new IngestionService(
        prismaMock as never,
        { pollIntervalMinutes: 60 },
        true,
        tmClient,
      );

      await service.runPollOnce();

      expect(prismaMock.event.create).not.toHaveBeenCalled();
      expect(prismaMock.sourceEntry.create).not.toHaveBeenCalled();
    });

    it('creates only SourceEntry when required Event fields are missing', async () => {
      const incompleteItem: SourceItem = {
        externalId: 'G5diZfkn0B-xx',
        title: 'Eminem TBA',
        url: 'https://www.ticketmaster.com/eminem-tba',
      };
      const prismaMock = createPrismaMock([ticketmasterSource]);
      const tmClient = createTmClient([incompleteItem]);
      const service = new IngestionService(
        prismaMock as never,
        { pollIntervalMinutes: 60 },
        true,
        tmClient,
      );

      await service.runPollOnce();

      expect(prismaMock.event.create).not.toHaveBeenCalled();
      expect(prismaMock.sourceEntry.create).toHaveBeenCalledWith({
        data: {
          sourceId: 'source-tm',
          artistId: 'artist-1',
          eventId: null,
          url: 'https://www.ticketmaster.com/eminem-tba',
          externalId: 'G5diZfkn0B-xx',
          title: 'Eminem TBA',
          confidence: 0.9,
        },
      });
    });

    it('skips Ticketmaster source when no client configured', async () => {
      const prismaMock = createPrismaMock([ticketmasterSource]);
      const service = new IngestionService(
        prismaMock as never,
        { pollIntervalMinutes: 60 },
        true,
        // no ticketmaster client
      );

      await service.runPollOnce();

      expect(prismaMock.event.create).not.toHaveBeenCalled();
      expect(prismaMock.sourceEntry.create).not.toHaveBeenCalled();
    });

    it('continues on Ticketmaster API error without crashing', async () => {
      const prismaMock = createPrismaMock([ticketmasterSource]);
      const tmClient = {
        getAllAttractionEvents: jest
          .fn()
          .mockRejectedValue(new Error('Ticketmaster API returned 429')),
      } as unknown as TicketmasterClient;
      const service = new IngestionService(
        prismaMock as never,
        { pollIntervalMinutes: 60 },
        true,
        tmClient,
      );

      await expect(service.runPollOnce()).resolves.not.toThrow();
      expect(prismaMock.event.create).not.toHaveBeenCalled();
      expect(prismaMock.sourceEntry.create).not.toHaveBeenCalled();
    });
  });
});
