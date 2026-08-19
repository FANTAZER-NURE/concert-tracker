import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import {
  MatchableEvent,
  MatchingService,
  SubscriptionMatch,
} from '../notifications/matching.service';
import { TelegramSender } from '../notifications/telegram.sender';
import {
  SOURCE_CONNECTORS,
  SourceConnector,
} from './connectors/source-connector';
import { continentFromCountry } from './continent';
import { TICKETMASTER_CLIENT } from './ticketmaster/ticketmaster.constants';
import { TicketmasterClient } from './ticketmaster/ticketmaster.client';
import { SourceItem } from './source-item';

export type IngestionRunResult = {
  processedEntries: number;
  createdEvents: number;
  reusedEvents: number;
  matches: SubscriptionMatch[];
  notificationsSent: number;
  notificationsSkipped: number;
};

type IngestionConfig = {
  pollIntervalMinutes: number;
};

function utcDayRange(startAt: Date) {
  const gte = new Date(
    Date.UTC(
      startAt.getUTCFullYear(),
      startAt.getUTCMonth(),
      startAt.getUTCDate(),
    ),
  );
  const lt = new Date(gte);
  lt.setUTCDate(lt.getUTCDate() + 1);
  return { gte, lt };
}

function parseStartAt(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function citiesEqual(
  stored: string | null | undefined,
  incoming: string,
) {
  return stored?.trim().toLowerCase() === incoming.trim().toLowerCase();
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly prismaService: PrismaService,
    @Inject('INGESTION_CONFIG') private readonly config: IngestionConfig,
    @Inject('INGESTION_AUTO_SCHEDULE') private readonly autoSchedule: boolean,
    @Inject(SOURCE_CONNECTORS)
    private readonly connectors: SourceConnector[],
    @Optional()
    @Inject(TICKETMASTER_CLIENT)
    private readonly ticketmasterClient?: TicketmasterClient,
    @Optional()
    private readonly matchingService?: MatchingService,
    @Optional()
    private readonly telegramSender?: TelegramSender,
  ) {}

  @Interval(60_000)
  async runScheduledPoll() {
    if (!this.autoSchedule) {
      return;
    }

    if (!this.shouldRunScheduledPoll()) {
      return;
    }

    await this.runPollOnce();
  }

  async runPollOnce(): Promise<IngestionRunResult> {
    this.logger.log('Starting ingestion poll');

    const sources = await this.prismaService.source.findMany({
      where: { isActive: true },
      select: {
        id: true,
        artistId: true,
        name: true,
        type: true,
        url: true,
        externalId: true,
      },
      orderBy: { name: 'asc' },
    });

    this.logger.log(`Found ${sources.length} active sources to poll`);
    await this.pollSources(sources);
    return this.processSourceEntries();
  }

  async refreshArtist(artistId: string): Promise<IngestionRunResult> {
    const sources = await this.prismaService.source.findMany({
      where: { isActive: true, artistId },
      select: {
        id: true,
        artistId: true,
        name: true,
        type: true,
        url: true,
        externalId: true,
      },
    });

    await this.pollSources(sources);
    return this.processSourceEntries(artistId);
  }

  private async pollSources(
    sources: Array<{
      id: string;
      artistId: string | null;
      name: string;
      type: string;
      url: string | null;
      externalId: string | null;
    }>,
  ) {
    for (const source of sources) {
      const connector = this.connectors.find((candidate) =>
        candidate.canHandle(source),
      );

      if (!connector) {
        this.logger.log(
          `No connector for source ${source.name} (${source.type}) — skipping`,
        );
        continue;
      }

      let items: SourceItem[];
      try {
        items = await connector.fetch(source);
      } catch (error) {
        this.logger.error(
          `Failed to fetch from ${source.name}: ${error}`,
        );
        continue;
      }

      await this.upsertSourceItems(source, items);
    }
  }

  private async upsertSourceItems(
    source: { id: string; artistId: string | null },
    items: SourceItem[],
  ) {
    for (const item of items) {
      const existing = await this.prismaService.sourceEntry.findUnique({
        where: {
          sourceId_externalId: {
            sourceId: source.id,
            externalId: item.externalId,
          },
        },
      });

      if (existing) {
        continue;
      }

      await this.prismaService.sourceEntry.create({
        data: {
          sourceId: source.id,
          artistId: source.artistId,
          url: item.url,
          externalId: item.externalId,
          title: item.title,
          rawData: item as any,
          confidence: 0.9,
          processed: false,
        },
      });
    }
  }

  async processSourceEntries(artistId?: string): Promise<IngestionRunResult> {
    const entries = await this.prismaService.sourceEntry.findMany({
      where: {
        processed: false,
        ...(artistId ? { artistId } : {}),
      },
      orderBy: { ingestedAt: 'asc' },
    });

    this.logger.log(`Processing ${entries.length} unprocessed source entries`);

    const createdEventIds = new Set<string>();
    const reusedEventIds = new Set<string>();
    const touchedEvents = new Map<string, MatchableEvent>();

    for (const entry of entries) {
      const rawData = entry.rawData as SourceItem | null;
      const artistId = entry.artistId;

      if (!artistId) {
        await this.prismaService.sourceEntry.update({
          where: { id: entry.id },
          data: { processed: true, skipReason: 'missing_artist' },
        });
        continue;
      }

      const hasRequiredFields =
        rawData &&
        rawData.title &&
        (rawData.startAt || rawData.dateText) &&
        rawData.city &&
        rawData.country;

      if (!hasRequiredFields) {
        await this.prismaService.sourceEntry.update({
          where: { id: entry.id },
          data: { processed: true, skipReason: 'missing_required_fields' },
        });
        continue;
      }

      const city = rawData.city?.trim() ?? '';
      if (!city) {
        await this.prismaService.sourceEntry.update({
          where: { id: entry.id },
          data: { processed: true, skipReason: 'missing_required_fields' },
        });
        continue;
      }
      const startAt = parseStartAt(rawData.startAt);
      const existingEvent = await this.findExistingEvent(
        artistId,
        rawData,
        city,
        startAt,
      );
      if (existingEvent) {
        await this.prismaService.sourceEntry.update({
          where: { id: entry.id },
          data: {
            eventId: existingEvent.id,
            processed: true,
            skipReason: null,
          },
        });
        if (!createdEventIds.has(existingEvent.id)) {
          reusedEventIds.add(existingEvent.id);
        }
        touchedEvents.set(existingEvent.id, {
          id: existingEvent.id,
          artistId,
          continent: continentFromCountry(rawData.country),
          country: rawData.country,
          city: existingEvent.city ?? city,
        });
        continue;
      }

      const venueId = await this.upsertVenue({ ...rawData, city });
      const continent = continentFromCountry(rawData.country);

      const event = await this.prismaService.event.create({
        data: {
          artistId,
          venueId,
          name: rawData.title,
          startAt: startAt ?? undefined,
          dateText: rawData.dateText ?? undefined,
          timezone: rawData.timezone ?? undefined,
          city,
          country: rawData.country,
          continent,
          ticketUrl: rawData.ticketUrl ?? undefined,
          priceMin: rawData.priceMin ?? undefined,
          priceMax: rawData.priceMax ?? undefined,
          currency: rawData.currency ?? undefined,
          confidence: entry.confidence ?? 0.5,
        },
      });

      await this.prismaService.sourceEntry.update({
        where: { id: entry.id },
        data: { eventId: event.id, processed: true },
      });

      createdEventIds.add(event.id);
      touchedEvents.set(event.id, {
        id: event.id,
        artistId,
        continent,
        country: rawData.country,
        city,
      });
    }

    const matches: SubscriptionMatch[] = [];
    if (this.matchingService) {
      for (const event of touchedEvents.values()) {
        const eventMatches =
          await this.matchingService.matchSubscriptions(event);
        matches.push(...eventMatches);
      }
      await this.matchingService.recordMatches(matches);
    }

    let notificationsSent = 0;
    let notificationsSkipped = 0;
    if (this.telegramSender) {
      const eventIds = [...new Set(matches.map((match) => match.eventId))];
      const dispatch = await this.telegramSender.dispatchPending(eventIds);
      notificationsSent = dispatch.sent;
      notificationsSkipped = dispatch.skipped;
    } else {
      notificationsSkipped = matches.length;
    }

    return {
      processedEntries: entries.length,
      createdEvents: createdEventIds.size,
      reusedEvents: reusedEventIds.size,
      matches,
      notificationsSent,
      notificationsSkipped,
    };
  }

  private async findExistingEvent(
    artistId: string,
    rawData: SourceItem,
    city: string,
    startAt: Date | null,
  ) {
    const pickByCity = (
      events: Array<{ id: string; city: string | null }>,
    ) => events.find((event) => citiesEqual(event.city, city));

    if (startAt) {
      const exactHits = await this.prismaService.event.findMany({
        where: { artistId, startAt },
        select: { id: true, city: true },
      });
      const exact = pickByCity(exactHits);
      if (exact) {
        this.logger.log(
          `Event match found id=${exact.id} artistId=${artistId} city=${city} startAt=${startAt.toISOString()}`,
        );
        return exact;
      }

      const dayHits = await this.prismaService.event.findMany({
        where: { artistId, startAt: utcDayRange(startAt) },
        select: { id: true, city: true },
      });
      const day = pickByCity(dayHits);
      if (day) {
        this.logger.log(
          `Event match found id=${day.id} artistId=${artistId} city=${city} startAt=${startAt.toISOString()}`,
        );
        return day;
      }

      this.logger.log(
        `Event match not found artistId=${artistId} city=${city} startAt=${startAt.toISOString()}`,
      );
      return null;
    }

    if (!rawData.dateText) {
      this.logger.log(
        `Event match not found artistId=${artistId} city=${city} startAt=invalid`,
      );
      return null;
    }

    const dateHits = await this.prismaService.event.findMany({
      where: { artistId, dateText: rawData.dateText },
      select: { id: true, city: true },
    });
    const byDate = pickByCity(dateHits);
    if (byDate) {
      this.logger.log(
        `Event match found id=${byDate.id} artistId=${artistId} city=${city} startAt=${rawData.dateText}`,
      );
      return byDate;
    }

    this.logger.log(
      `Event match not found artistId=${artistId} city=${city} startAt=${rawData.dateText}`,
    );
    return null;
  }

  private async upsertVenue(rawData: SourceItem): Promise<string | null> {
    if (!rawData.venueName) {
      return null;
    }

    const existing = await this.prismaService.venue.findFirst({
      where: {
        name: rawData.venueName,
        city: rawData.city,
        country: rawData.country,
      },
    });

    if (existing) {
      return existing.id;
    }

    const venue = await this.prismaService.venue.create({
      data: {
        name: rawData.venueName,
        city: rawData.city,
        country: rawData.country,
        continent: continentFromCountry(rawData.country),
        latitude: rawData.latitude,
        longitude: rawData.longitude,
      },
    });

    return venue.id;
  }

  private shouldRunScheduledPoll() {
    if (
      !this.config.pollIntervalMinutes ||
      this.config.pollIntervalMinutes <= 0
    ) {
      return false;
    }

    const now = new Date();
    const minutes = now.getUTCMinutes();

    return minutes % this.config.pollIntervalMinutes === 0;
  }

  public getArtist(artistName: string) {
    if (!this.ticketmasterClient) {
      this.logger.warn(
        'Ticketmaster source found but no API key configured — skipping',
      );
      return;
    }
    return this.ticketmasterClient.searchAttractions(artistName);
  }
}
