import { IngestionService } from './ingestion.service';

const fixedNow = new Date('2026-02-01T12:00:00.000Z');

describe('IngestionService', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('creates SourceEntry and placeholder Event for active source with artist', async () => {
    const source = {
      id: 'source-1',
      artistId: 'artist-1',
      name: 'Instagram',
      url: 'https://instagram.com/eminem',
      externalId: null,
    };
    const prismaMock = {
      source: {
        findMany: jest.fn().mockResolvedValue([source]),
      },
      sourceEntry: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'entry-1' }),
      },
      event: {
        create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      },
    };
    const service = new IngestionService(
      prismaMock as never,
      {
        pollIntervalMinutes: 60,
      },
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
      url: 'https://instagram.com/eminem',
      externalId: null,
    };
    const prismaMock = {
      source: {
        findMany: jest.fn().mockResolvedValue([source]),
      },
      sourceEntry: {
        findUnique: jest.fn().mockResolvedValue({ id: 'entry-1' }),
        create: jest.fn(),
      },
      event: {
        create: jest.fn(),
      },
    };
    const service = new IngestionService(
      prismaMock as never,
      {
        pollIntervalMinutes: 60,
      },
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
      url: 'https://songkick.com',
      externalId: null,
    };
    const prismaMock = {
      source: {
        findMany: jest.fn().mockResolvedValue([source]),
      },
      sourceEntry: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'entry-1' }),
      },
      event: {
        create: jest.fn(),
      },
    };
    const service = new IngestionService(
      prismaMock as never,
      {
        pollIntervalMinutes: 60,
      },
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
