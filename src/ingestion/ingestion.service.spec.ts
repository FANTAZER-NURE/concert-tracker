import { TicketmasterConnector } from './connectors/ticketmaster.connector';
import { IngestionService } from './ingestion.service';
import { SourceItem } from './source-item';
import { TicketmasterClient } from './ticketmaster/ticketmaster.client';

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
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'event-1' }),
    },
    venue: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'venue-1' }),
    },
  };
}

describe('IngestionService', () => {
  describe('unknown source polling', () => {
    it('skips sources with no matching connector', async () => {
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
        [new TicketmasterConnector()],
      );

      await service.runPollOnce();

      expect(prismaMock.event.create).not.toHaveBeenCalled();
      expect(prismaMock.sourceEntry.create).not.toHaveBeenCalled();
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
        [new TicketmasterConnector(tmClient)],
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
        [new TicketmasterConnector(tmClient)],
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
        [new TicketmasterConnector()],
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
        [new TicketmasterConnector(tmClient)],
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
      latitude: 40.7505,
      longitude: -73.9934,
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
        [],
      );

      await service.processSourceEntries();

      expect(prismaMock.venue.findFirst).toHaveBeenCalledWith({
        where: {
          name: 'Madison Square Garden',
          city: 'New York',
          country: 'US',
        },
      });
      expect(prismaMock.venue.create).toHaveBeenCalledWith({
        data: {
          name: 'Madison Square Garden',
          city: 'New York',
          country: 'US',
          continent: 'North America',
          latitude: 40.7505,
          longitude: -73.9934,
        },
      });
      expect(prismaMock.event.create).toHaveBeenCalledWith({
        data: {
          artistId: 'artist-1',
          venueId: 'venue-1',
          name: 'Eminem Live 2026',
          startAt: new Date('2026-07-15T19:00:00Z'),
          dateText: '2026-07-15',
          timezone: 'America/New_York',
          city: 'New York',
          country: 'US',
          continent: 'North America',
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

    it('reuses an existing venue matched by name, city, and country', async () => {
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
      prismaMock.venue.findFirst.mockResolvedValue({ id: 'existing-venue' });
      const service = new IngestionService(
        prismaMock as never,
        { pollIntervalMinutes: 60 },
        true,
        [],
      );

      await service.processSourceEntries();

      expect(prismaMock.venue.create).not.toHaveBeenCalled();
      expect(prismaMock.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ venueId: 'existing-venue' }),
        }),
      );
    });

    it('creates Event without venue when venueName is missing', async () => {
      const entry = {
        id: 'entry-1',
        sourceId: 'source-tm',
        artistId: 'artist-1',
        eventId: null,
        rawData: { ...sampleRawData, venueName: undefined },
        confidence: 0.9,
        processed: false,
      };
      const prismaMock = createPrismaMock([], [entry]);
      const service = new IngestionService(
        prismaMock as never,
        { pollIntervalMinutes: 60 },
        true,
        [],
      );

      await service.processSourceEntries();

      expect(prismaMock.venue.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.venue.create).not.toHaveBeenCalled();
      expect(prismaMock.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ venueId: null }),
        }),
      );
    });

    it('sets continent to null for an unmapped country code', async () => {
      const entry = {
        id: 'entry-1',
        sourceId: 'source-tm',
        artistId: 'artist-1',
        eventId: null,
        rawData: { ...sampleRawData, country: 'EG', venueName: undefined },
        confidence: 0.9,
        processed: false,
      };
      const prismaMock = createPrismaMock([], [entry]);
      const service = new IngestionService(
        prismaMock as never,
        { pollIntervalMinutes: 60 },
        true,
        [],
      );

      await service.processSourceEntries();

      expect(prismaMock.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            country: 'EG',
            continent: null,
          }),
        }),
      );
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
        [],
      );

      await service.processSourceEntries();

      expect(prismaMock.event.create).not.toHaveBeenCalled();
      expect(prismaMock.sourceEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-2' },
        data: { processed: true, skipReason: 'missing_required_fields' },
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
        [],
      );

      await service.processSourceEntries();

      expect(prismaMock.event.create).not.toHaveBeenCalled();
      expect(prismaMock.sourceEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-3' },
        data: { processed: true, skipReason: 'missing_artist' },
      });
    });

    it('reuses one Event for two entries with the same artist, day, and city', async () => {
      const entry1 = {
        id: 'entry-1',
        sourceId: 'source-tm',
        artistId: 'artist-1',
        eventId: null,
        rawData: sampleRawData,
        confidence: 0.9,
        processed: false,
      };
      const entry2 = {
        id: 'entry-2',
        sourceId: 'source-other',
        artistId: 'artist-1',
        eventId: null,
        rawData: { ...sampleRawData, externalId: 'other-id', city: 'new york' },
        confidence: 0.8,
        processed: false,
      };
      const prismaMock = createPrismaMock([], [entry1, entry2]);
      prismaMock.event.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'event-1', city: 'New York' }]);
      const service = new IngestionService(
        prismaMock as never,
        { pollIntervalMinutes: 60 },
        true,
        [],
      );

      await service.processSourceEntries();

      expect(prismaMock.event.findMany).toHaveBeenNthCalledWith(1, {
        where: {
          artistId: 'artist-1',
          startAt: new Date('2026-07-15T19:00:00Z'),
        },
        select: { id: true, city: true },
      });
      expect(prismaMock.event.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          artistId: 'artist-1',
          startAt: {
            gte: new Date('2026-07-15T00:00:00.000Z'),
            lt: new Date('2026-07-16T00:00:00.000Z'),
          },
        },
        select: { id: true, city: true },
      });
      expect(prismaMock.event.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.sourceEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-1' },
        data: { eventId: 'event-1', processed: true },
      });
      expect(prismaMock.sourceEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-2' },
        data: { eventId: 'event-1', processed: true, skipReason: null },
      });
    });

    it('reuses an Event when rawData.startAt is an ISO string from Prisma Json', async () => {
      const entry = {
        id: 'entry-clone',
        sourceId: 'source-clone',
        artistId: 'artist-1',
        eventId: null,
        rawData: {
          ...sampleRawData,
          startAt: '2026-07-15T19:00:00.000Z',
        },
        confidence: 0.9,
        processed: false,
      };
      const prismaMock = createPrismaMock([], [entry]);
      prismaMock.event.findMany.mockResolvedValueOnce([
        { id: 'event-1', city: 'New York' },
      ]);
      const service = new IngestionService(
        prismaMock as never,
        { pollIntervalMinutes: 60 },
        true,
        [],
      );

      await service.processSourceEntries();

      expect(prismaMock.event.findMany).toHaveBeenNthCalledWith(1, {
        where: {
          artistId: 'artist-1',
          startAt: new Date('2026-07-15T19:00:00.000Z'),
        },
        select: { id: true, city: true },
      });
      expect(prismaMock.event.create).not.toHaveBeenCalled();
      expect(prismaMock.sourceEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-clone' },
        data: { eventId: 'event-1', processed: true, skipReason: null },
      });
    });

    it('falls back to dateText when rawData.startAt is not a valid date', async () => {
      const entry = {
        id: 'entry-bad-date',
        sourceId: 'source-tm',
        artistId: 'artist-1',
        eventId: null,
        rawData: { ...sampleRawData, startAt: {} },
        confidence: 0.9,
        processed: false,
      };
      const prismaMock = createPrismaMock([], [entry]);
      prismaMock.event.findMany.mockResolvedValueOnce([
        { id: 'event-1', city: 'New York' },
      ]);
      const service = new IngestionService(
        prismaMock as never,
        { pollIntervalMinutes: 60 },
        true,
        [],
      );

      await service.processSourceEntries();

      expect(prismaMock.event.findMany).toHaveBeenCalledWith({
        where: { artistId: 'artist-1', dateText: '2026-07-15' },
        select: { id: true, city: true },
      });
      expect(prismaMock.event.create).not.toHaveBeenCalled();
      expect(prismaMock.sourceEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-bad-date' },
        data: { eventId: 'event-1', processed: true, skipReason: null },
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
        [],
      );

      await service.processSourceEntries();

      expect(prismaMock.event.create).not.toHaveBeenCalled();
      expect(prismaMock.sourceEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-4' },
        data: { processed: true, skipReason: 'missing_required_fields' },
      });
    });

    it('matches subscriptions for a newly created event', async () => {
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
      const matches = [
        {
          eventId: 'event-1',
          userId: 'user-1',
          subscriptionId: 'sub-1',
        },
      ];
      const matching = {
        matchSubscriptions: jest.fn().mockResolvedValue(matches),
        recordMatches: jest.fn().mockResolvedValue(undefined),
      };
      const telegram = {
        dispatchPending: jest.fn().mockResolvedValue({ sent: 0, skipped: 1 }),
      };
      const service = new IngestionService(
        prismaMock as never,
        { pollIntervalMinutes: 60 },
        true,
        [],
        undefined,
        matching as never,
        telegram as never,
      );

      await expect(service.processSourceEntries()).resolves.toEqual({
        processedEntries: 1,
        createdEvents: 1,
        reusedEvents: 0,
        matches,
        notificationsSent: 0,
        notificationsSkipped: 1,
      });
      expect(matching.matchSubscriptions).toHaveBeenCalledWith({
        id: 'event-1',
        artistId: 'artist-1',
        continent: 'North America',
        country: 'US',
        city: 'New York',
      });
      expect(matching.recordMatches).toHaveBeenCalledWith(matches);
      expect(telegram.dispatchPending).toHaveBeenCalledWith(['event-1']);
    });

    it('matches subscriptions for an event attached in this run', async () => {
      const entry = {
        id: 'entry-clone',
        sourceId: 'source-clone',
        artistId: 'artist-1',
        eventId: null,
        rawData: sampleRawData,
        confidence: 0.9,
        processed: false,
      };
      const prismaMock = createPrismaMock([], [entry]);
      prismaMock.event.findMany.mockResolvedValueOnce([
        { id: 'event-1', city: 'New York' },
      ]);
      const matches = [
        {
          eventId: 'event-1',
          userId: 'user-1',
          subscriptionId: 'sub-1',
        },
      ];
      const matching = {
        matchSubscriptions: jest.fn().mockResolvedValue(matches),
        recordMatches: jest.fn().mockResolvedValue(undefined),
      };
      const telegram = {
        dispatchPending: jest.fn().mockResolvedValue({ sent: 0, skipped: 1 }),
      };
      const service = new IngestionService(
        prismaMock as never,
        { pollIntervalMinutes: 60 },
        true,
        [],
        undefined,
        matching as never,
        telegram as never,
      );

      await expect(service.processSourceEntries()).resolves.toEqual({
        processedEntries: 1,
        createdEvents: 0,
        reusedEvents: 1,
        matches,
        notificationsSent: 0,
        notificationsSkipped: 1,
      });
      expect(matching.matchSubscriptions).toHaveBeenCalledWith({
        id: 'event-1',
        artistId: 'artist-1',
        continent: 'North America',
        country: 'US',
        city: 'New York',
      });
      expect(telegram.dispatchPending).toHaveBeenCalledWith(['event-1']);
    });

    it('does not match skipped entries and matches a created event only once', async () => {
      const skipped = {
        id: 'entry-skip',
        sourceId: 'source-tm',
        artistId: 'artist-1',
        eventId: null,
        rawData: { externalId: 'abc', title: 'TBA', url: 'http://example.com' },
        confidence: 0.9,
        processed: false,
      };
      const created = {
        id: 'entry-1',
        sourceId: 'source-tm',
        artistId: 'artist-1',
        eventId: null,
        rawData: sampleRawData,
        confidence: 0.9,
        processed: false,
      };
      const reused = {
        id: 'entry-2',
        sourceId: 'source-other',
        artistId: 'artist-1',
        eventId: null,
        rawData: { ...sampleRawData, externalId: 'other-id', city: 'new york' },
        confidence: 0.8,
        processed: false,
      };
      const prismaMock = createPrismaMock([], [skipped, created, reused]);
      prismaMock.event.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'event-1', city: 'New York' }]);
      const matching = {
        matchSubscriptions: jest.fn().mockResolvedValue([]),
        recordMatches: jest.fn().mockResolvedValue(undefined),
      };
      const telegram = {
        dispatchPending: jest.fn().mockResolvedValue({ sent: 0, skipped: 0 }),
      };
      const service = new IngestionService(
        prismaMock as never,
        { pollIntervalMinutes: 60 },
        true,
        [],
        undefined,
        matching as never,
        telegram as never,
      );

      await expect(service.processSourceEntries()).resolves.toEqual({
        processedEntries: 3,
        createdEvents: 1,
        reusedEvents: 0,
        matches: [],
        notificationsSent: 0,
        notificationsSkipped: 0,
      });
      expect(telegram.dispatchPending).toHaveBeenCalledWith([]);
      expect(matching.matchSubscriptions).toHaveBeenCalledTimes(1);
      expect(matching.matchSubscriptions).toHaveBeenCalledWith({
        id: 'event-1',
        artistId: 'artist-1',
        continent: 'North America',
        country: 'US',
        city: 'New York',
      });
    });
  });
});
