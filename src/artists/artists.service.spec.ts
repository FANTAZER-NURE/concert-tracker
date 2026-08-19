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

  it('returns active artists ordered by name', async () => {
    const artists = [{ id: '1', name: 'Eminem', isActive: true }];
    const prismaMock = {
      artist: {
        findMany: jest.fn().mockResolvedValue(artists),
      },
    };
    const service = new ArtistsService(prismaMock as never);

    await expect(service.listActive()).resolves.toEqual(artists);
    expect(prismaMock.artist.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  });

  it('finds an active artist by id', async () => {
    const artist = { id: '1', name: 'Eminem', isActive: true };
    const prismaMock = {
      artist: {
        findFirst: jest.fn().mockResolvedValue(artist),
      },
    };
    const service = new ArtistsService(prismaMock as never);

    await expect(service.findActiveById('1')).resolves.toEqual(artist);
    expect(prismaMock.artist.findFirst).toHaveBeenCalledWith({
      where: { id: '1', isActive: true },
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
