import { Inject, Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';

type IngestionConfig = {
  pollIntervalMinutes: number;
};

@Injectable()
export class IngestionService {
  constructor(
    private readonly prismaService: PrismaService,
    @Inject('INGESTION_CONFIG') private readonly config: IngestionConfig,
    @Inject('INGESTION_AUTO_SCHEDULE') private readonly autoSchedule: boolean,
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
    const sources = await this.prismaService.source.findMany({
      where: { isActive: true },
      select: {
        id: true,
        artistId: true,
        name: true,
        url: true,
        externalId: true,
      },
      orderBy: { name: 'asc' },
    });

    const pollExternalId = this.getPollExternalId();

    for (const source of sources) {
      const existing = await this.prismaService.sourceEntry.findUnique({
        where: {
          sourceId_externalId: {
            sourceId: source.id,
            externalId: pollExternalId,
          },
        },
      });

      if (existing) {
        continue;
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
  }

  private getPollExternalId() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');

    return `poll-${year}-${month}-${day}`;
  }

  private shouldRunScheduledPoll() {
    if (!this.config.pollIntervalMinutes || this.config.pollIntervalMinutes <= 0) {
      return false;
    }

    const now = new Date();
    const minutes = now.getUTCMinutes();

    return minutes % this.config.pollIntervalMinutes === 0;
  }
}
