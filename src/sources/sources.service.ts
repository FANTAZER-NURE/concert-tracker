import { Injectable } from '@nestjs/common';
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
}
