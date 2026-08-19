import { EventsService } from './events.service';

describe('EventsService', () => {
  it('returns events ordered by creation time', async () => {
    const events = [
      { id: '1', artistId: 'artist-1', name: 'Show 1' },
      { id: '2', artistId: 'artist-2', name: 'Show 2' },
    ];
    const prismaMock = {
      event: {
        findMany: jest.fn().mockResolvedValue(events),
      },
    };
    const service = new EventsService(prismaMock as never);

    await expect(service.list()).resolves.toEqual(events);
    expect(prismaMock.event.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
    });
  });

  it('creates an event', async () => {
    const startAt = new Date('2026-01-01T00:00:00.000Z');
    const created = {
      id: '1',
      artistId: 'artist-1',
      name: 'Show 1',
      startAt,
    };
    const prismaMock = {
      event: {
        create: jest.fn().mockResolvedValue(created),
      },
    };
    const service = new EventsService(prismaMock as never);

    await expect(
      service.create({
        artistId: 'artist-1',
        name: 'Show 1',
        startAt,
        city: 'Detroit',
        country: 'US',
      }),
    ).resolves.toEqual(created);
    expect(prismaMock.event.create).toHaveBeenCalledWith({
      data: {
        artistId: 'artist-1',
        name: 'Show 1',
        startAt,
        city: 'Detroit',
        country: 'US',
      },
    });
  });

  it('lists upcoming and recent shows for an artist', async () => {
    const now = new Date('2026-08-18T12:00:00Z');
    const prismaMock = {
      event: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]),
      },
    };
    const service = new EventsService(prismaMock as never);

    await expect(
      service.listRecentAndUpcoming('artist-1', now),
    ).resolves.toEqual({
      upcoming: [],
      upcomingHasMore: false,
      recent: [],
      recentHasMore: false,
    });
    expect(prismaMock.event.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        artistId: 'artist-1',
        OR: [{ startAt: { gte: now } }, { startAt: null }],
      },
      orderBy: { startAt: 'asc' },
      take: 9,
      select: {
        startAt: true,
        dateText: true,
        city: true,
        country: true,
        ticketUrl: true,
        venue: { select: { name: true } },
      },
    });
  });
});
