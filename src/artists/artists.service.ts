import { Injectable } from '@nestjs/common';
import { CreateArtistInput } from './artists.schema';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ArtistsService {
  constructor(private readonly prismaService: PrismaService) {}

  list() {
    return this.prismaService.artist.findMany({
      orderBy: { name: 'asc' },
    });
  }

  create(input: CreateArtistInput) {
    return this.prismaService.artist.create({
      data: { name: input.name },
    });
  }
}
