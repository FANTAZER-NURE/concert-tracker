import { Inject, Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TICKETMASTER_CLIENT } from '../ingestion/ticketmaster/ticketmaster.constants';
import type {
  TicketmasterAttraction,
  TicketmasterClient,
} from '../ingestion/ticketmaster/ticketmaster.client';
import { SourcesService } from '../sources/sources.service';
import { ArtistsService } from './artists.service';

export type ArtistResolveResult =
  | { status: 'ready'; artist: { id: string; name: string } }
  | { status: 'tm_choices'; attractions: TicketmasterAttraction[] }
  | { status: 'local_choices'; artists: { id: string; name: string }[] }
  | { status: 'not_found' };

@Injectable()
export class ArtistOnboardingService {
  constructor(
    private readonly artistsService: ArtistsService,
    private readonly sourcesService: SourcesService,
    @Optional()
    @Inject(TICKETMASTER_CLIENT)
    private readonly ticketmasterClient?: TicketmasterClient,
  ) {}

  async resolveByName(rawName: string): Promise<ArtistResolveResult> {
    const query = rawName.trim();
    if (query.length < 2) {
      return { status: 'not_found' };
    }

    const local = await this.artistsService.findActiveByName(query);
    if (local) {
      await this.attachTicketmaster(local.id, query);
      return { status: 'ready', artist: local };
    }

    if (!this.ticketmasterClient) {
      const fuzzy = await this.artistsService.searchActiveByName(query);
      if (fuzzy.length > 0) {
        return { status: 'local_choices', artists: fuzzy };
      }
      return { status: 'not_found' };
    }

    const attractions = await this.ticketmasterClient.searchAttractions(query);
    if (attractions.length === 0) {
      const fuzzy = await this.artistsService.searchActiveByName(query);
      if (fuzzy.length > 0) {
        return { status: 'local_choices', artists: fuzzy };
      }
      return { status: 'not_found' };
    }

    const exact = attractions.find(
      (attraction) => attraction.name.toLowerCase() === query.toLowerCase(),
    );
    if (exact || attractions.length === 1) {
      const artist = await this.ensureFromAttraction(exact ?? attractions[0]);
      return { status: 'ready', artist };
    }

    return { status: 'tm_choices', attractions };
  }

  async ensureFromAttraction(attraction: TicketmasterAttraction) {
    let artist = await this.artistsService.findByName(attraction.name);
    if (!artist) {
      try {
        artist = await this.artistsService.create({ name: attraction.name });
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2002'
        ) {
          throw error;
        }
        artist = await this.artistsService.findByName(attraction.name);
      }
    }
    if (!artist) {
      throw new Error(`Could not persist artist ${attraction.name}`);
    }
    if (!artist.isActive) {
      artist = await this.artistsService.reactivate(artist.id);
    }

    await this.sourcesService.ensureTicketmaster(artist.id, attraction.id);
    return artist;
  }

  private async attachTicketmaster(artistId: string, query: string) {
    if (!this.ticketmasterClient) {
      return;
    }
    try {
      const attractions =
        await this.ticketmasterClient.searchAttractions(query);
      const match =
        attractions.find(
          (attraction) =>
            attraction.name.toLowerCase() === query.toLowerCase(),
        ) ?? attractions[0];
      if (match) {
        await this.sourcesService.ensureTicketmaster(artistId, match.id);
      }
    } catch {
      return;
    }
  }
}
