import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService', () => {
  it('returns subscriptions ordered by creation time', async () => {
    const subscriptions = [
      { id: '1', userId: 'user-1', artistId: 'artist-1' },
      { id: '2', userId: 'user-1', artistId: 'artist-2' },
    ];
    const prismaMock = {
      subscription: {
        findMany: jest.fn().mockResolvedValue(subscriptions),
      },
    };
    const service = new SubscriptionsService(prismaMock as never);

    await expect(service.list()).resolves.toEqual(subscriptions);
    expect(prismaMock.subscription.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
    });
  });

  it('creates a subscription', async () => {
    const created = {
      id: '1',
      userId: 'user-1',
      artistId: 'artist-1',
      country: 'US',
    };
    const prismaMock = {
      subscription: {
        create: jest.fn().mockResolvedValue(created),
      },
    };
    const service = new SubscriptionsService(prismaMock as never);

    await expect(
      service.create({
        userId: 'user-1',
        artistId: 'artist-1',
        country: 'US',
      }),
    ).resolves.toEqual(created);
    expect(prismaMock.subscription.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        artistId: 'artist-1',
        country: 'US',
      },
    });
  });

  it('lists active subscriptions for a user with artist names', async () => {
    const subscriptions = [
      {
        id: '1',
        userId: 'user-1',
        artist: { name: 'Kansas' },
      },
    ];
    const prismaMock = {
      subscription: {
        findMany: jest.fn().mockResolvedValue(subscriptions),
      },
    };
    const service = new SubscriptionsService(prismaMock as never);

    await expect(service.listForUser('user-1')).resolves.toEqual(subscriptions);
    expect(prismaMock.subscription.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', isActive: true },
      include: { artist: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('creates a subscription when ensure finds none', async () => {
    const created = {
      id: '1',
      userId: 'user-1',
      artistId: 'artist-1',
      continent: 'Europe',
      country: null,
      city: null,
      radiusKm: null,
      isActive: true,
    };
    const prismaMock = {
      subscription: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(created),
      },
    };
    const service = new SubscriptionsService(prismaMock as never);

    await expect(
      service.ensure({
        userId: 'user-1',
        artistId: 'artist-1',
        continent: 'Europe',
      }),
    ).resolves.toEqual({
      created: true,
      reactivated: false,
      subscription: created,
    });
  });

  it('reactivates an inactive matching subscription', async () => {
    const existing = {
      id: '1',
      userId: 'user-1',
      artistId: 'artist-1',
      continent: null,
      country: null,
      city: null,
      radiusKm: null,
      isActive: false,
    };
    const prismaMock = {
      subscription: {
        findFirst: jest.fn().mockResolvedValue(existing),
        update: jest.fn().mockResolvedValue({ ...existing, isActive: true }),
      },
    };
    const service = new SubscriptionsService(prismaMock as never);

    await expect(
      service.ensure({
        userId: 'user-1',
        artistId: 'artist-1',
      }),
    ).resolves.toEqual({
      created: false,
      reactivated: true,
      subscription: { ...existing, isActive: true },
    });
  });

  it('deactivates a subscription owned by the user', async () => {
    const existing = { id: '1', userId: 'user-1', isActive: true };
    const prismaMock = {
      subscription: {
        findFirst: jest.fn().mockResolvedValue(existing),
        update: jest.fn().mockResolvedValue({ ...existing, isActive: false }),
      },
    };
    const service = new SubscriptionsService(prismaMock as never);

    await expect(service.deactivateForUser('1', 'user-1')).resolves.toEqual({
      ...existing,
      isActive: false,
    });
  });
});
