import { TelegramConversation } from './telegram.conversation';

const from = { id: 598221727, username: 'fantazer_2002' };

const sessions = () => ({
  get: jest.fn(),
  set: jest.fn(),
  clear: jest.fn(),
});

const conversation = (overrides: {
  users?: object;
  artists?: object;
  onboarding?: object;
  subscriptions?: object;
  events?: object;
  ingestion?: object;
  sessions?: ReturnType<typeof sessions>;
}) =>
  new TelegramConversation(
    (overrides.users ?? {}) as never,
    (overrides.artists ?? {}) as never,
    (overrides.onboarding ?? {}) as never,
    (overrides.subscriptions ?? {}) as never,
    (overrides.events ?? {}) as never,
    (overrides.ingestion ?? {}) as never,
    (overrides.sessions ?? sessions()) as never,
  );

describe('TelegramConversation', () => {
  it('upserts the user on /start and returns the home menu', async () => {
    const users = {
      upsertFromTelegram: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };
    const store = sessions();
    const reply = await conversation({ users, sessions: store }).start(from);

    expect(store.clear).toHaveBeenCalledWith('598221727');
    expect(users.upsertFromTelegram).toHaveBeenCalledWith(from);
    expect(reply.text).toContain('Concert Tracker');
    expect(reply.text).toContain('➕ Add artist');
    expect(reply.buttons).toEqual([
      [{ label: '➕ Add artist', data: 'menu:sub' }],
      [
        { label: '📋 My alerts', data: 'menu:list' },
        { label: '📅 Shows', data: 'menu:shows' },
      ],
      [
        { label: '❓ Help', data: 'menu:help' },
        { label: '⏸ Pause alerts', data: 'menu:stop' },
      ],
    ]);
  });

  it('asks for a typed name and still offers the catalog', async () => {
    const store = sessions();
    const reply = await conversation({
      artists: {
        listActive: jest.fn().mockResolvedValue([{ id: 'a1', name: 'Kansas' }]),
      },
      sessions: store,
    }).subscribeMenu('598221727');

    expect(store.set).toHaveBeenCalledWith('598221727', {
      step: 'awaiting_name',
    });
    expect(reply.text).toContain('Type the artist name');
    expect(reply.buttons).toEqual([
      [{ label: '🎵 Kansas', data: 'art:a1' }],
      [{ label: '🏠 Menu', data: 'menu:home' }],
    ]);
  });

  it('opens the region picker after a typed name resolves', async () => {
    const store = sessions();
    const reply = await conversation({
      artists: {
        findActiveById: jest
          .fn()
          .mockResolvedValue({ id: 'a1', name: 'Beyoncé' }),
      },
      onboarding: {
        resolveByName: jest.fn().mockResolvedValue({
          status: 'ready',
          artist: { id: 'a1', name: 'Beyoncé' },
        }),
      },
      sessions: store,
    }).submitArtistName('598221727', 'Beyonce');

    expect(store.clear).toHaveBeenCalledWith('598221727');
    expect(reply.text).toContain('Where should I watch Beyoncé?');
  });

  it('creates a worldwide subscription for the chosen artist', async () => {
    const subscriptions = {
      ensure: jest.fn().mockResolvedValue({
        created: true,
        reactivated: false,
      }),
    };
    const reply = await conversation({
      users: {
        findByTelegramId: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      artists: {
        findActiveById: jest
          .fn()
          .mockResolvedValue({ id: 'a1', name: 'Kansas' }),
      },
      subscriptions,
    }).chooseRegion('598221727', 'a1', 'WW');

    expect(subscriptions.ensure).toHaveBeenCalledWith({
      userId: 'user-1',
      artistId: 'a1',
      continent: null,
      country: null,
      city: null,
      radiusKm: null,
    });
    expect(reply.text).toContain('Now watching Kansas · Worldwide');
    expect(reply.buttons?.[0]?.[0]).toEqual({
      label: '📅 See shows',
      data: 'shows:a1',
    });
  });

  it('lists subscriptions with remove buttons', async () => {
    await expect(
      conversation({
        users: {
          findByTelegramId: jest.fn().mockResolvedValue({ id: 'user-1' }),
        },
        subscriptions: {
          listForUser: jest.fn().mockResolvedValue([
            {
              id: 's1',
              continent: 'North America',
              country: null,
              city: null,
              artist: { id: 'a1', name: 'Kansas' },
            },
          ]),
        },
      }).mySubscriptions('598221727'),
    ).resolves.toEqual({
      text: '📋 Kansas · North America',
      buttons: [
        [{ label: '➕ Add artist', data: 'menu:sub' }],
        [
          { label: '📅 Kansas', data: 'shows:a1' },
          { label: '🗑 North America', data: 'off:s1' },
        ],
        [{ label: '🏠 Menu', data: 'menu:home' }],
      ],
    });
  });

  it('lists upcoming and recent shows after a Ticketmaster refresh', async () => {
    const ingestion = {
      refreshArtist: jest.fn().mockResolvedValue({}),
    };
    const events = {
      listRecentAndUpcoming: jest.fn().mockResolvedValue({
        upcoming: [
          {
            startAt: new Date('2026-09-18T00:00:00Z'),
            dateText: null,
            city: 'Lincoln',
            country: 'US',
            ticketUrl: null,
            venue: { name: 'Pinnacle Bank Arena' },
          },
        ],
        upcomingHasMore: false,
        recent: [],
        recentHasMore: false,
      }),
    };

    const reply = await conversation({
      artists: {
        findActiveById: jest
          .fn()
          .mockResolvedValue({ id: 'a1', name: 'Kansas' }),
      },
      events,
      ingestion,
    }).showConcerts('a1');

    expect(ingestion.refreshArtist).toHaveBeenCalledWith('a1');
    expect(reply.text).toContain('📅 Upcoming');
    expect(reply.text).toContain('Lincoln, Pinnacle Bank Arena');
  });
});
