import { ArtistOnboardingService } from './artist-onboarding.service';

describe('ArtistOnboardingService', () => {
  it('returns a catalog artist and attaches Ticketmaster', async () => {
    const artists = {
      findActiveByName: jest
        .fn()
        .mockResolvedValue({ id: 'a1', name: 'Kansas' }),
    };
    const sources = {
      ensureTicketmaster: jest.fn().mockResolvedValue({}),
    };
    const ticketmaster = {
      searchAttractions: jest
        .fn()
        .mockResolvedValue([{ id: 'tm-1', name: 'Kansas' }]),
    };
    const service = new ArtistOnboardingService(
      artists as never,
      sources as never,
      ticketmaster as never,
    );

    await expect(service.resolveByName('kansas')).resolves.toEqual({
      status: 'ready',
      artist: { id: 'a1', name: 'Kansas' },
    });
    expect(sources.ensureTicketmaster).toHaveBeenCalledWith('a1', 'tm-1');
  });

  it('creates an artist from a single Ticketmaster match', async () => {
    const created = { id: 'a2', name: 'Beyoncé', isActive: true };
    const artists = {
      findActiveByName: jest.fn().mockResolvedValue(null),
      findByName: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(created),
    };
    const sources = {
      ensureTicketmaster: jest.fn().mockResolvedValue({}),
    };
    const ticketmaster = {
      searchAttractions: jest
        .fn()
        .mockResolvedValue([{ id: 'tm-2', name: 'Beyoncé' }]),
    };
    const service = new ArtistOnboardingService(
      artists as never,
      sources as never,
      ticketmaster as never,
    );

    await expect(service.resolveByName('Beyonce')).resolves.toEqual({
      status: 'ready',
      artist: created,
    });
    expect(artists.create).toHaveBeenCalledWith({ name: 'Beyoncé' });
    expect(sources.ensureTicketmaster).toHaveBeenCalledWith('a2', 'tm-2');
  });

  it('returns Ticketmaster choices when several names match', async () => {
    const attractions = [
      { id: '1', name: 'The Weeknd' },
      { id: '2', name: 'The Weekend' },
    ];
    const service = new ArtistOnboardingService(
      {
        findActiveByName: jest.fn().mockResolvedValue(null),
        searchActiveByName: jest.fn().mockResolvedValue([]),
      } as never,
      {} as never,
      { searchAttractions: jest.fn().mockResolvedValue(attractions) } as never,
    );

    await expect(service.resolveByName('The Week')).resolves.toEqual({
      status: 'tm_choices',
      attractions,
    });
  });

  it('returns not_found when Ticketmaster has no match', async () => {
    const service = new ArtistOnboardingService(
      {
        findActiveByName: jest.fn().mockResolvedValue(null),
        searchActiveByName: jest.fn().mockResolvedValue([]),
      } as never,
      {} as never,
      { searchAttractions: jest.fn().mockResolvedValue([]) } as never,
    );

    await expect(service.resolveByName('asdfgh')).resolves.toEqual({
      status: 'not_found',
    });
  });
});
