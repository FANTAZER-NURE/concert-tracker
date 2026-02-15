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
