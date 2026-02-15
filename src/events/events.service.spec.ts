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
});
