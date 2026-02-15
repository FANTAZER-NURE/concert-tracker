import { BadRequestException } from '@nestjs/common';
import { SourceType } from '@prisma/client';
import { SourcesController } from './sources.controller';

describe('SourcesController', () => {
  it('returns list from service', async () => {
    const sources = [{ id: '1', name: 'Songkick', type: SourceType.EVENT_API }];
    const service = {
      list: jest.fn().mockResolvedValue(sources),
    };
    const controller = new SourcesController(service as never);

    await expect(controller.list()).resolves.toEqual(sources);
    expect(service.list).toHaveBeenCalledTimes(1);
  });

  it('creates source via service', async () => {
    const created = { id: '1', name: 'Instagram', type: SourceType.SOCIAL };
    const service = {
      create: jest.fn().mockResolvedValue(created),
    };
    const controller = new SourcesController(service as never);

    await expect(
      controller.create({
        artistId: 'artist-1',
        type: SourceType.SOCIAL,
        name: 'Instagram',
        url: 'https://instagram.com/test',
      }),
    ).resolves.toEqual(created);
    expect(service.create).toHaveBeenCalledWith({
      artistId: 'artist-1',
      type: SourceType.SOCIAL,
      name: 'Instagram',
      url: 'https://instagram.com/test',
    });
  });

  it('throws when url and externalId are missing', () => {
    const service = {
      create: jest.fn(),
    };
    const controller = new SourcesController(service as never);

    expect(() =>
      controller.create({
        artistId: 'artist-1',
        type: SourceType.SOCIAL,
        name: 'Instagram',
      }),
    ).toThrow(BadRequestException);
    expect(service.create).not.toHaveBeenCalled();
  });
});
