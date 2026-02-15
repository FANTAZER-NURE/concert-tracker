import { BadRequestException } from '@nestjs/common';
import { EventsController } from './events.controller';

describe('EventsController', () => {
  it('returns list from service', async () => {
    const events = [{ id: '1', artistId: 'artist-1', name: 'Show 1' }];
    const service = {
      list: jest.fn().mockResolvedValue(events),
    };
    const controller = new EventsController(service as never);

    await expect(controller.list()).resolves.toEqual(events);
    expect(service.list).toHaveBeenCalledTimes(1);
  });

  it('creates event via service', async () => {
    const created = { id: '1', artistId: 'artist-1', name: 'Show 1' };
    const service = {
      create: jest.fn().mockResolvedValue(created),
    };
    const controller = new EventsController(service as never);

    await expect(
      controller.create({
        artistId: 'artist-1',
        name: 'Show 1',
        startAt: '2026-01-01T00:00:00.000Z',
        city: 'Detroit',
        country: 'US',
      }),
    ).resolves.toEqual(created);
    expect(service.create).toHaveBeenCalledWith({
      artistId: 'artist-1',
      name: 'Show 1',
      startAt: '2026-01-01T00:00:00.000Z',
      city: 'Detroit',
      country: 'US',
    });
  });

  it('throws when required fields are missing', () => {
    const service = {
      create: jest.fn(),
    };
    const controller = new EventsController(service as never);

    expect(() =>
      controller.create({
        artistId: 'artist-1',
        name: 'Show 1',
      }),
    ).toThrow(BadRequestException);
    expect(service.create).not.toHaveBeenCalled();
  });
});
