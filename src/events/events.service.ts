import { Injectable } from '@nestjs/common';
import { CreateEventInput } from './events.schema';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class EventsService {
  constructor(private readonly prismaService: PrismaService) {}

  list() {
    return this.prismaService.event.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async listRecentAndUpcoming(artistId: string, now = new Date()) {
    const recentSince = new Date(now);
    recentSince.setUTCDate(recentSince.getUTCDate() - 180);

    const showSelect = {
      startAt: true,
      dateText: true,
      city: true,
      country: true,
      ticketUrl: true,
      venue: { select: { name: true } },
    } as const;

    const [upcomingRows, recentRows] = await Promise.all([
      this.prismaService.event.findMany({
        where: {
          artistId,
          OR: [{ startAt: { gte: now } }, { startAt: null }],
        },
        orderBy: { startAt: 'asc' },
        take: 9,
        select: showSelect,
      }),
      this.prismaService.event.findMany({
        where: {
          artistId,
          startAt: { lt: now, gte: recentSince },
        },
        orderBy: { startAt: 'desc' },
        take: 6,
        select: showSelect,
      }),
    ]);

    return {
      upcoming: upcomingRows.slice(0, 8),
      upcomingHasMore: upcomingRows.length > 8,
      recent: recentRows.slice(0, 5),
      recentHasMore: recentRows.length > 5,
    };
  }

  create(input: CreateEventInput) {
    const startAt = new Date(input.startAt);
    const endAt = input.endAt ? new Date(input.endAt) : undefined;

    return this.prismaService.event.create({
      data: {
        artistId: input.artistId,
        venueId: input.venueId ?? undefined,
        name: input.name,
        startAt,
        endAt,
        timezone: input.timezone ?? undefined,
        city: input.city,
        country: input.country,
        continent: input.continent ?? undefined,
        ticketUrl: input.ticketUrl ?? undefined,
        priceMin: input.priceMin ?? undefined,
        priceMax: input.priceMax ?? undefined,
        currency: input.currency ?? undefined,
      },
    });
  }
}
