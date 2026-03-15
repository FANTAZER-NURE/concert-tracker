import { IngestionService } from './ingestion.service';
import { SourceItem } from './source-item';
import { TicketmasterClient } from './ticketmaster/ticketmaster.client';

const fixedNow = new Date('2026-02-01T12:00:00.000Z');

function createPrismaMock(sources: any[] = [], unprocessedEntries: any[] = []) {
  return {
    source: {
      findMany: jest.fn().mockResolvedValue(sources),
    },
    sourceEntry: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue(unprocessedEntries),
      create: jest.fn().mockResolvedValue({ id: 'entry-1' }),
      update: jest.fn().mockResolvedValue({}),
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
    it('creates SourceEntry without Event for active source with artist', async () => {
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

      expect(prismaMock.event.create).not.toHaveBeenCalled();
      expect(prismaMock.sourceEntry.create).toHaveBeenCalledWith({
        data: {
          sourceId: 'source-1',
          artistId: 'artist-1',
          url: 'https://instagram.com/eminem',
          externalId: 'poll-2026-02-01',
          title: 'Pending event from Instagram',
          processed: false,
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

    it('creates SourceEntry without Event when source has no artist', async () => {
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
          url: 'https://songkick.com',
          externalId: 'poll-2026-02-01',
          title: 'Pending event from Songkick',
          processed: false,
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

    it('creates SourceEntry with rawData from Ticketmaster data', async () => {
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
      expect(prismaMock.sourceEntry.create).toHaveBeenCalledWith({
        data: {
          sourceId: 'source-tm',
          artistId: 'artist-1',
          url: 'https://www.ticketmaster.com/eminem-live-2026',
          externalId: 'G5diZfkn0B-bh',
          title: 'Eminem Live 2026',
          rawData: sampleItem,
          confidence: 0.9,
          processed: false,
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

      expect(prismaMock.sourceEntry.create).not.toHaveBeenCalled();
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
      expect(prismaMock.sourceEntry.create).not.toHaveBeenCalled();
    });
  });

  describe('processSourceEntries', () => {
    const sampleRawData: SourceItem = {
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

    it('creates Event from unprocessed entry with complete rawData', async () => {
      const entry = {
        id: 'entry-1',
        sourceId: 'source-tm',
        artistId: 'artist-1',
        eventId: null,
        rawData: sampleRawData,
        confidence: 0.9,
        processed: false,
      };
      const prismaMock = createPrismaMock([], [entry]);
      const service = new IngestionService(
        prismaMock as never,
        { pollIntervalMinutes: 60 },
        true,
      );

      await service.processSourceEntries();

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
      expect(prismaMock.sourceEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-1' },
        data: { eventId: 'event-1', processed: true },
      });
    });

    it('marks entry processed without Event when rawData lacks required fields', async () => {
      const entry = {
        id: 'entry-2',
        sourceId: 'source-tm',
        artistId: 'artist-1',
        eventId: null,
        rawData: { externalId: 'abc', title: 'TBA', url: 'http://example.com' },
        confidence: 0.9,
        processed: false,
      };
      const prismaMock = createPrismaMock([], [entry]);
      const service = new IngestionService(
        prismaMock as never,
        { pollIntervalMinutes: 60 },
        true,
      );

      await service.processSourceEntries();

      expect(prismaMock.event.create).not.toHaveBeenCalled();
      expect(prismaMock.sourceEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-2' },
        data: { processed: true },
      });
    });

    it('marks entry processed without Event when no artistId', async () => {
      const entry = {
        id: 'entry-3',
        sourceId: 'source-1',
        artistId: null,
        eventId: null,
        rawData: sampleRawData,
        confidence: 0.5,
        processed: false,
      };
      const prismaMock = createPrismaMock([], [entry]);
      const service = new IngestionService(
        prismaMock as never,
        { pollIntervalMinutes: 60 },
        true,
      );

      await service.processSourceEntries();

      expect(prismaMock.event.create).not.toHaveBeenCalled();
      expect(prismaMock.sourceEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-3' },
        data: { processed: true },
      });
    });

    it('marks entry processed without Event when rawData is null', async () => {
      const entry = {
        id: 'entry-4',
        sourceId: 'source-1',
        artistId: 'artist-1',
        eventId: null,
        rawData: null,
        confidence: null,
        processed: false,
      };
      const prismaMock = createPrismaMock([], [entry]);
      const service = new IngestionService(
        prismaMock as never,
        { pollIntervalMinutes: 60 },
        true,
      );

      await service.processSourceEntries();

      expect(prismaMock.event.create).not.toHaveBeenCalled();
      expect(prismaMock.sourceEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-4' },
        data: { processed: true },
      });
    });
  });
});
