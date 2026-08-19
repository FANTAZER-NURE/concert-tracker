import { Injectable } from '@nestjs/common';
import { ArtistOnboardingService } from '../artists/artist-onboarding.service';
import { ArtistsService } from '../artists/artists.service';
import { EventsService } from '../events/events.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { regionByCode, SUBSCRIPTION_REGIONS } from './regions';
import { TelegramSessionStore } from './telegram.session';
import { formatConcerts } from './telegram.shows';
import { TelegramUserService } from './telegram-user.service';
import {
  ADD_ARTIST_BUTTON,
  afterWatchButtons,
  chunk,
  formatScope,
  HOME_BUTTONS,
  MENU_BUTTON,
} from './telegram.menu';
import type { BotReply } from './telegram.reply';
import type { TelegramProfile } from './telegram-user.service';

@Injectable()
export class TelegramConversation {
  constructor(
    private readonly telegramUserService: TelegramUserService,
    private readonly artistsService: ArtistsService,
    private readonly artistOnboardingService: ArtistOnboardingService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly eventsService: EventsService,
    private readonly ingestionService: IngestionService,
    private readonly sessions: TelegramSessionStore,
  ) {}

  welcome(): BotReply {
    return {
      text: [
        '🎵 Concert Tracker',
        '',
        'Tap Add artist and type a name. I check Ticketmaster, add them if they exist, then you pick a region.',
        '',
        '➕ Add artist: start watching someone',
        '📋 My alerts: what you already watch, or remove it',
        '📅 Shows: recent and upcoming concerts',
        '❓ Help: slash commands',
        '⏸ Pause alerts: stop messages until you come back',
      ].join('\n'),
      buttons: HOME_BUTTONS,
    };
  }

  help(): BotReply {
    return {
      text: [
        'To watch someone: Add artist → type the name → pick a region.',
        '',
        '/subscribe or /artists: add an artist by name',
        '/subscriptions: what you already watch',
        '/shows: recent and upcoming concerts',
        '/help: this list',
        '/stop: pause messages',
      ].join('\n'),
      buttons: HOME_BUTTONS,
    };
  }

  async start(from: TelegramProfile): Promise<BotReply> {
    this.sessions.clear(String(from.id));
    await this.telegramUserService.upsertFromTelegram(from);
    return this.welcome();
  }

  async stop(telegramId: string): Promise<BotReply> {
    const user = await this.telegramUserService.deactivate(telegramId);
    if (!user) {
      return { text: 'Nothing to pause. Send /start first.' };
    }
    return {
      text: 'Alerts paused. Resume when you want them back.',
      buttons: [[{ label: '▶️ Resume', data: 'menu:home' }]],
    };
  }

  async listArtists(telegramId: string): Promise<BotReply> {
    return this.subscribeMenu(telegramId);
  }

  async subscribeMenu(telegramId: string): Promise<BotReply> {
    this.sessions.set(telegramId, { step: 'awaiting_name' });
    const artists = await this.artistsService.listActive();
    const catalog =
      artists.length === 0
        ? []
        : artists.map((artist) => [
            { label: `🎵 ${artist.name}`, data: `art:${artist.id}` },
          ]);

    return {
      text: [
        'Type the artist name. I look them up on Ticketmaster and add them if they exist.',
        catalog.length > 0 ? '' : null,
        catalog.length > 0 ? 'Or tap someone we already track:' : null,
      ]
        .filter((line): line is string => line !== null)
        .join('\n'),
      buttons: [...catalog, [MENU_BUTTON]],
    };
  }

  async submitArtistName(
    telegramId: string,
    rawName: string,
  ): Promise<BotReply> {
    const query = rawName.trim();
    if (query.length < 2) {
      this.sessions.set(telegramId, { step: 'awaiting_name' });
      return {
        text: 'Type at least two letters of the artist name.',
        buttons: [[MENU_BUTTON]],
      };
    }

    const result = await this.artistOnboardingService.resolveByName(query);
    if (result.status === 'ready') {
      this.sessions.clear(telegramId);
      return this.chooseArtist(result.artist.id);
    }
    if (result.status === 'local_choices') {
      this.sessions.set(telegramId, { step: 'awaiting_name' });
      return {
        text: `I could not add "${query}" from Ticketmaster. Did you mean one of these?`,
        buttons: [
          ...result.artists.map((artist) => [
            { label: `🎵 ${artist.name}`, data: `art:${artist.id}` },
          ]),
          [MENU_BUTTON],
        ],
      };
    }
    if (result.status === 'tm_choices') {
      this.sessions.set(telegramId, {
        step: 'tm_choices',
        attractions: result.attractions,
      });
      return {
        text: `A few Ticketmaster matches for "${query}". Tap the right one.`,
        buttons: [
          ...result.attractions.map((attraction) => [
            {
              label: `🎵 ${attraction.name}${
                attraction.upcomingCount > 0
                  ? ` (${attraction.upcomingCount})`
                  : ''
              }`,
              data: `tm:${attraction.id}`,
            },
          ]),
          [MENU_BUTTON],
        ],
      };
    }

    this.sessions.set(telegramId, { step: 'awaiting_name' });
    return {
      text: `I could not find "${query}" on Ticketmaster. Try another spelling.`,
      buttons: [[MENU_BUTTON]],
    };
  }

  async pickAttraction(
    telegramId: string,
    attractionId: string,
  ): Promise<BotReply> {
    const session = this.sessions.get(telegramId);
    if (session?.step !== 'tm_choices') {
      return {
        text: 'That search expired. Type the artist name again.',
        buttons: [[ADD_ARTIST_BUTTON]],
      };
    }

    const attraction = session.attractions.find(
      (item) => item.id === attractionId,
    );
    if (!attraction) {
      return {
        text: 'That match expired. Type the artist name again.',
        buttons: [[ADD_ARTIST_BUTTON]],
      };
    }

    const artist =
      await this.artistOnboardingService.ensureFromAttraction(attraction);
    this.sessions.clear(telegramId);
    return this.chooseArtist(artist.id);
  }

  async chooseArtist(artistId: string): Promise<BotReply> {
    const artist = await this.artistsService.findActiveById(artistId);
    if (!artist) {
      return { text: 'That artist is gone. Try /subscribe again.' };
    }

    const regionButtons = SUBSCRIPTION_REGIONS.filter(
      (region) => region.code !== 'WW',
    ).map((region) => ({
      label: `${region.emoji} ${region.label}`,
      data: `reg:${artist.id}:${region.code}`,
    }));

    return {
      text: `Where should I watch ${artist.name}?`,
      buttons: [
        [{ label: '🌐 Worldwide', data: `reg:${artist.id}:WW` }],
        ...chunk(regionButtons, 2),
        [MENU_BUTTON],
      ],
    };
  }

  async chooseRegion(
    telegramId: string,
    artistId: string,
    regionCode: string,
  ): Promise<BotReply> {
    const region = regionByCode(regionCode);
    const artist = await this.artistsService.findActiveById(artistId);
    if (!region || !artist) {
      return { text: 'That choice expired. Try /subscribe again.' };
    }

    const user = await this.telegramUserService.findByTelegramId(telegramId);
    if (!user) {
      return { text: 'Send /start first, then subscribe.' };
    }

    const result = await this.subscriptionsService.ensure({
      userId: user.id,
      artistId: artist.id,
      continent: region.continent,
      country: null,
      city: null,
      radiusKm: null,
    });

    if (result.created) {
      return {
        text: `Now watching ${artist.name} · ${region.label}. See their shows or add another artist.`,
        buttons: afterWatchButtons(artist.id),
      };
    }
    if (result.reactivated) {
      return {
        text: `Alerts for ${artist.name} · ${region.label} are back on. See their shows or add another artist.`,
        buttons: afterWatchButtons(artist.id),
      };
    }
    return {
      text: `Already watching ${artist.name} · ${region.label}. See their shows or add another artist.`,
      buttons: afterWatchButtons(artist.id),
    };
  }

  async mySubscriptions(telegramId: string): Promise<BotReply> {
    const user = await this.telegramUserService.findByTelegramId(telegramId);
    if (!user) {
      return { text: 'Send /start first.' };
    }

    const subscriptions = await this.subscriptionsService.listForUser(user.id);
    if (subscriptions.length === 0) {
      return {
        text: 'You are not watching anyone yet. Add an artist to start.',
        buttons: [[ADD_ARTIST_BUTTON], [MENU_BUTTON]],
      };
    }

    return {
      text: subscriptions
        .map((sub) => `📋 ${sub.artist.name} · ${formatScope(sub)}`)
        .join('\n'),
      buttons: [
        [ADD_ARTIST_BUTTON],
        ...subscriptions.map((sub) => [
          {
            label: `📅 ${sub.artist.name}`,
            data: `shows:${sub.artist.id}`,
          },
          {
            label: `🗑 ${formatScope(sub)}`,
            data: `off:${sub.id}`,
          },
        ]),
        [MENU_BUTTON],
      ],
    };
  }

  async showsMenu(): Promise<BotReply> {
    const artists = await this.artistsService.listActive();
    if (artists.length === 0) {
      return {
        text: 'No artists yet. Add one first, then I can list shows.',
        buttons: [[ADD_ARTIST_BUTTON], [MENU_BUTTON]],
      };
    }
    return {
      text: 'Whose recent and upcoming shows do you want?',
      buttons: [
        ...artists.map((artist) => [
          { label: `📅 ${artist.name}`, data: `shows:${artist.id}` },
        ]),
        [MENU_BUTTON],
      ],
    };
  }

  async showConcerts(artistId: string): Promise<BotReply> {
    const artist = await this.artistsService.findActiveById(artistId);
    if (!artist) {
      return { text: 'That artist is gone. Try Shows again.' };
    }

    let refreshOk = true;
    try {
      await this.ingestionService.refreshArtist(artist.id);
    } catch {
      refreshOk = false;
    }

    const listing = await this.eventsService.listRecentAndUpcoming(artist.id);
    return {
      text: formatConcerts(artist.name, listing, { ok: refreshOk }),
      buttons: [
        [{ label: '📅 Another artist', data: 'menu:shows' }],
        [MENU_BUTTON],
      ],
    };
  }

  async unsubscribe(
    telegramId: string,
    subscriptionId: string,
  ): Promise<BotReply> {
    const user = await this.telegramUserService.findByTelegramId(telegramId);
    if (!user) {
      return { text: 'Send /start first.' };
    }

    const removed = await this.subscriptionsService.deactivateForUser(
      subscriptionId,
      user.id,
    );
    if (!removed) {
      return { text: 'That alert is already gone.' };
    }
    return this.mySubscriptions(telegramId);
  }
}
