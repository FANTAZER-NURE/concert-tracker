import { BadRequestException } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';

describe('SubscriptionsController', () => {
  it('returns list from service', async () => {
    const subscriptions = [{ id: '1', userId: 'user-1', artistId: 'artist-1' }];
    const service = {
      list: jest.fn().mockResolvedValue(subscriptions),
    };
    const controller = new SubscriptionsController(service as never);

    await expect(controller.list()).resolves.toEqual(subscriptions);
    expect(service.list).toHaveBeenCalledTimes(1);
  });

  it('creates subscription via service', async () => {
    const created = { id: '1', userId: 'user-1', artistId: 'artist-1' };
    const service = {
      create: jest.fn().mockResolvedValue(created),
    };
    const controller = new SubscriptionsController(service as never);

    await expect(
      controller.create({ userId: 'user-1', artistId: 'artist-1' }),
    ).resolves.toEqual(created);
    expect(service.create).toHaveBeenCalledWith({
      userId: 'user-1',
      artistId: 'artist-1',
    });
  });

  it('throws when userId is missing', () => {
    const service = {
      create: jest.fn(),
    };
    const controller = new SubscriptionsController(service as never);

    expect(() =>
      controller.create({ artistId: 'artist-1' } as never),
    ).toThrow(BadRequestException);
    expect(service.create).not.toHaveBeenCalled();
  });
});
