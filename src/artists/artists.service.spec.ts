import { ArtistsService } from './artists.service';

describe('ArtistsService', () => {
  it('returns artists ordered by name', async () => {
    const artists = [
      { id: '1', name: 'Eminem' },
      { id: '2', name: 'Red Hot Chili Peppers' },
    ];
    const prismaMock = {
      artist: {
        findMany: jest.fn().mockResolvedValue(artists),
      },
    };
    const service = new ArtistsService(prismaMock as never);

    await expect(service.list()).resolves.toEqual(artists);
    expect(prismaMock.artist.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
    });
  });

  it('creates an artist by name', async () => {
    const created = { id: '1', name: 'Eminem' };
    const prismaMock = {
      artist: {
        create: jest.fn().mockResolvedValue(created),
      },
    };
    const service = new ArtistsService(prismaMock as never);

    await expect(service.create({ name: 'Eminem' })).resolves.toEqual(created);
    expect(prismaMock.artist.create).toHaveBeenCalledWith({
      data: { name: 'Eminem' },
    });
  });
});
