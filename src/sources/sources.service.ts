import { Injectable } from '@nestjs/common';
import { SourceType } from '@prisma/client';
import { CreateSourceInput } from './sources.schema';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SourcesService {
  constructor(private readonly prismaService: PrismaService) {}

  list() {
    return this.prismaService.source.findMany({
      orderBy: { name: 'asc' },
    });
  }

  create(input: CreateSourceInput) {
    return this.prismaService.source.create({
      data: {
        artistId: input.artistId,
        type: input.type,
        name: input.name,
        url: input.url,
        externalId: input.externalId,
      },
    });
  }

  async ensureTicketmaster(artistId: string, externalId: string) {
    const existing = await this.prismaService.source.findFirst({
      where: {
        artistId,
        type: SourceType.EVENT_API,
        name: 'Ticketmaster',
      },
    });
    if (existing) {
      if (existing.externalId === externalId) {
        return existing;
      }
      return this.prismaService.source.update({
        where: { id: existing.id },
        data: { externalId, isActive: true },
      });
    }

    return this.prismaService.source.create({
      data: {
        artistId,
        type: SourceType.EVENT_API,
        name: 'Ticketmaster',
        externalId,
      },
    });
  }
}
