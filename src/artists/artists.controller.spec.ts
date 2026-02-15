import { BadRequestException } from '@nestjs/common';
import { ArtistsController } from './artists.controller';

describe('ArtistsController', () => {
  it('returns list from service', async () => {
    const artists = [{ id: '1', name: 'Eminem' }];
    const service = {
      list: jest.fn().mockResolvedValue(artists),
    };
    const controller = new ArtistsController(service as never);

    await expect(controller.list()).resolves.toEqual(artists);
    expect(service.list).toHaveBeenCalledTimes(1);
  });

  it('creates artist via service', async () => {
    const created = { id: '1', name: 'Eminem' };
    const service = {
      create: jest.fn().mockResolvedValue(created),
    };
    const controller = new ArtistsController(service as never);

    await expect(controller.create({ name: 'Eminem' })).resolves.toEqual(created);
    expect(service.create).toHaveBeenCalledWith({ name: 'Eminem' });
  });

  it('throws when name is empty', () => {
    const service = {
      create: jest.fn(),
    };
    const controller = new ArtistsController(service as never);

    expect(() => controller.create({ name: '' })).toThrow(BadRequestException);
    expect(service.create).not.toHaveBeenCalled();
  });
});
