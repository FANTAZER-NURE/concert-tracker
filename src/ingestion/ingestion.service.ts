import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { TicketmasterClient } from './ticketmaster/ticketmaster.client';
import { SourceItem } from './source-item';

type IngestionConfig = {
  pollIntervalMinutes: number;
};

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly prismaService: PrismaService,
    @Inject('INGESTION_CONFIG') private readonly config: IngestionConfig,
    @Inject('INGESTION_AUTO_SCHEDULE') private readonly autoSchedule: boolean,
    @Optional()
    @Inject('TICKETMASTER_CLIENT')
    private readonly ticketmasterClient?: TicketmasterClient,
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

  async runPollOnce() {
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

    for (const source of sources) {
      if (
        source.type === 'EVENT_API' &&
        source.name === 'Ticketmaster' &&
        source.externalId
      ) {
        await this.pollTicketmaster(source);
      } else {
        await this.pollGenericSource(source);
      }
    }
  }

  private async pollTicketmaster(source: {
    id: string;
    artistId: string | null;
    name: string;
    externalId: string | null;
  }) {
    if (!this.ticketmasterClient) {
      this.logger.warn(
        'Ticketmaster source found but no API key configured — skipping',
      );
      return;
    }

    if (!source.externalId || !source.artistId) {
      return;
    }

    let items: SourceItem[];
    try {
      items = await this.ticketmasterClient.getAllAttractionEvents(
        source.externalId,
      );
    } catch (error) {
      this.logger.error(
        `Failed to fetch Ticketmaster events for attraction ${source.externalId}: ${error}`,
      );
      return;
    }

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

      let eventId: string | null = null;
      const hasRequiredFields =
        item.title &&
        (item.startAt || item.dateText) &&
        item.city &&
        item.country;

      if (hasRequiredFields) {
        const event = await this.prismaService.event.create({
          data: {
            artistId: source.artistId,
            name: item.title,
            startAt: item.startAt ?? undefined,
            dateText: item.dateText ?? undefined,
            timezone: item.timezone ?? undefined,
            city: item.city,
            country: item.country,
            ticketUrl: item.ticketUrl ?? undefined,
            priceMin: item.priceMin ?? undefined,
            priceMax: item.priceMax ?? undefined,
            currency: item.currency ?? undefined,
            confidence: 0.9,
          },
        });
        eventId = event.id;
      }

      await this.prismaService.sourceEntry.create({
        data: {
          sourceId: source.id,
          artistId: source.artistId,
          eventId,
          url: item.url,
          externalId: item.externalId,
          title: item.title,
          confidence: 0.9,
        },
      });
    }
  }

  private async pollGenericSource(source: {
    id: string;
    artistId: string | null;
    name: string;
    url: string | null;
    externalId: string | null;
  }) {
    const pollExternalId = this.getPollExternalId();

    const existing = await this.prismaService.sourceEntry.findUnique({
      where: {
        sourceId_externalId: {
          sourceId: source.id,
          externalId: pollExternalId,
        },
      },
    });

    if (existing) {
      return;
    }

    const title = `Pending event from ${source.name}`;
    const url = source.url ?? source.externalId ?? source.name;
    let eventId: string | null = null;

    if (source.artistId) {
      const event = await this.prismaService.event.create({
        data: {
          artistId: source.artistId,
          name: title,
          confidence: 0.1,
        },
      });
      eventId = event.id;
    }

    await this.prismaService.sourceEntry.create({
      data: {
        sourceId: source.id,
        artistId: source.artistId,
        eventId,
        url,
        externalId: pollExternalId,
        title,
      },
    });
  }

  private getPollExternalId() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');

    return `poll-${year}-${month}-${day}`;
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
}
