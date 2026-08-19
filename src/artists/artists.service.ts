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

  listActive() {
    return this.prismaService.artist.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  findActiveById(id: string) {
    return this.prismaService.artist.findFirst({
      where: { id, isActive: true },
    });
  }

  findByName(name: string) {
    return this.prismaService.artist.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
      },
    });
  }

  findActiveByName(name: string) {
    return this.prismaService.artist.findFirst({
      where: {
        isActive: true,
        name: { equals: name, mode: 'insensitive' },
      },
    });
  }

  searchActiveByName(name: string) {
    return this.prismaService.artist.findMany({
      where: {
        isActive: true,
        name: { contains: name, mode: 'insensitive' },
      },
      select: { id: true, name: true },
      take: 5,
      orderBy: { name: 'asc' },
    });
  }

  create(input: CreateArtistInput) {
    return this.prismaService.artist.create({
      data: { name: input.name },
    });
  }

  reactivate(id: string) {
    return this.prismaService.artist.update({
      where: { id },
      data: { isActive: true },
    });
  }
}
