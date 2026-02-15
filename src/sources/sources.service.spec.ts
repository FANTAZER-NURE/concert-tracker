import { SourceType } from '@prisma/client';
import { SourcesService } from './sources.service';

describe('SourcesService', () => {
  it('returns sources ordered by name', async () => {
    const sources = [
      { id: '1', name: 'Songkick', type: SourceType.EVENT_API },
      { id: '2', name: 'Instagram', type: SourceType.SOCIAL },
    ];
    const prismaMock = {
      source: {
        findMany: jest.fn().mockResolvedValue(sources),
      },
    };
    const service = new SourcesService(prismaMock as never);

    await expect(service.list()).resolves.toEqual(sources);
    expect(prismaMock.source.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
    });
  });

  it('creates a source', async () => {
    const created = {
      id: '1',
      artistId: 'artist-1',
      type: SourceType.SOCIAL,
      name: 'Instagram',
      url: 'https://instagram.com/test',
    };
    const prismaMock = {
      source: {
        create: jest.fn().mockResolvedValue(created),
      },
    };
    const service = new SourcesService(prismaMock as never);

    await expect(
      service.create({
        artistId: 'artist-1',
        type: SourceType.SOCIAL,
        name: 'Instagram',
        url: 'https://instagram.com/test',
      }),
    ).resolves.toEqual(created);
    expect(prismaMock.source.create).toHaveBeenCalledWith({
      data: {
        artistId: 'artist-1',
        type: SourceType.SOCIAL,
        name: 'Instagram',
        url: 'https://instagram.com/test',
      },
    });
  });
});
