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
});
