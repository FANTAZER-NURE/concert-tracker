import { NotificationStatus } from '@prisma/client';
import { MatchingService } from './matching.service';

const usEvent = {
  id: 'event-1',
  artistId: 'artist-kansas',
  continent: 'North America',
  country: 'US',
  city: 'Kansas City',
};

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    userId: 'user-1',
    artistId: 'artist-kansas',
    continent: 'North America',
    country: 'US',
    city: null,
    radiusKm: 50,
    isActive: true,
    ...overrides,
  };
}

describe('MatchingService', () => {
  it('matches an active subscription on artist, continent, and country', async () => {
    const prismaMock = {
      subscription: {
        findMany: jest.fn().mockResolvedValue([subscription()]),
      },
    };
    const service = new MatchingService(prismaMock as never);

    await expect(service.matchSubscriptions(usEvent)).resolves.toEqual([
      {
        eventId: 'event-1',
        userId: 'user-1',
        subscriptionId: 'sub-1',
      },
    ]);
    expect(prismaMock.subscription.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        artistId: 'artist-kansas',
        user: { isActive: true },
      },
    });
  });

  it('skips inactive subscriptions', async () => {
    const prismaMock = {
      subscription: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new MatchingService(prismaMock as never);

    await expect(service.matchSubscriptions(usEvent)).resolves.toEqual([]);
  });

  it('skips a subscription when continent differs', async () => {
    const prismaMock = {
      subscription: {
        findMany: jest
          .fn()
          .mockResolvedValue([subscription({ continent: 'Europe' })]),
      },
    };
    const service = new MatchingService(prismaMock as never);

    await expect(service.matchSubscriptions(usEvent)).resolves.toEqual([]);
  });

  it('matches continent case-insensitively', async () => {
    const prismaMock = {
      subscription: {
        findMany: jest
          .fn()
          .mockResolvedValue([subscription({ continent: 'north america' })]),
      },
    };
    const service = new MatchingService(prismaMock as never);

    await expect(service.matchSubscriptions(usEvent)).resolves.toEqual([
      {
        eventId: 'event-1',
        userId: 'user-1',
        subscriptionId: 'sub-1',
      },
    ]);
  });

  it('skips a subscription when country differs', async () => {
    const prismaMock = {
      subscription: {
        findMany: jest
          .fn()
          .mockResolvedValue([subscription({ country: 'CA' })]),
      },
    };
    const service = new MatchingService(prismaMock as never);

    await expect(service.matchSubscriptions(usEvent)).resolves.toEqual([]);
  });

  it('matches country codes case-insensitively', async () => {
    const prismaMock = {
      subscription: {
        findMany: jest
          .fn()
          .mockResolvedValue([subscription({ country: 'us' })]),
      },
    };
    const service = new MatchingService(prismaMock as never);

    await expect(service.matchSubscriptions(usEvent)).resolves.toEqual([
      {
        eventId: 'event-1',
        userId: 'user-1',
        subscriptionId: 'sub-1',
      },
    ]);
  });

  it('skips a subscription when city differs', async () => {
    const prismaMock = {
      subscription: {
        findMany: jest
          .fn()
          .mockResolvedValue([subscription({ city: 'Chicago' })]),
      },
    };
    const service = new MatchingService(prismaMock as never);

    await expect(service.matchSubscriptions(usEvent)).resolves.toEqual([]);
  });

  it('matches city case-insensitively', async () => {
    const prismaMock = {
      subscription: {
        findMany: jest
          .fn()
          .mockResolvedValue([subscription({ city: 'kansas city' })]),
      },
    };
    const service = new MatchingService(prismaMock as never);

    await expect(service.matchSubscriptions(usEvent)).resolves.toEqual([
      {
        eventId: 'event-1',
        userId: 'user-1',
        subscriptionId: 'sub-1',
      },
    ]);
  });

  it('treats unset geo filters as unconstrained', async () => {
    const prismaMock = {
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          subscription({
            continent: null,
            country: null,
            city: null,
          }),
        ]),
      },
    };
    const service = new MatchingService(prismaMock as never);

    await expect(service.matchSubscriptions(usEvent)).resolves.toEqual([
      {
        eventId: 'event-1',
        userId: 'user-1',
        subscriptionId: 'sub-1',
      },
    ]);
  });

  it('ignores radiusKm when deciding a match', async () => {
    const prismaMock = {
      subscription: {
        findMany: jest
          .fn()
          .mockResolvedValue([subscription({ radiusKm: 1 })]),
      },
    };
    const service = new MatchingService(prismaMock as never);

    await expect(service.matchSubscriptions(usEvent)).resolves.toHaveLength(1);
  });

  it('persists one pending notification per event and user', async () => {
    const prismaMock = {
      subscription: { findMany: jest.fn() },
      notification: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new MatchingService(prismaMock as never);

    await service.recordMatches([
      {
        eventId: 'event-1',
        userId: 'user-1',
        subscriptionId: 'sub-1',
      },
      {
        eventId: 'event-1',
        userId: 'user-1',
        subscriptionId: 'sub-2',
      },
    ]);

    expect(prismaMock.notification.createMany).toHaveBeenCalledWith({
      data: [
        {
          eventId: 'event-1',
          userId: 'user-1',
          subscriptionId: 'sub-1',
          status: NotificationStatus.PENDING,
        },
      ],
      skipDuplicates: true,
    });
  });

  it('does not persist when there are no matches', async () => {
    const prismaMock = {
      subscription: { findMany: jest.fn() },
      notification: {
        createMany: jest.fn(),
      },
    };
    const service = new MatchingService(prismaMock as never);

    await service.recordMatches([]);

    expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
  });
});
