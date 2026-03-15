import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { SourceItem } from '../source-item';

const BASE_URL = 'https://app.ticketmaster.com/discovery/v2';
const PAGE_SIZE = 50;
const REQUEST_DELAY_MS = 210; // stay under 5 req/sec limit

export type TicketmasterEventsPage = {
  items: SourceItem[];
  totalPages: number;
  totalElements: number;
};

export type TicketmasterAttraction = {
  id: string;
  name: string;
};

@Injectable()
export class TicketmasterClient {
  private readonly logger = new Logger(TicketmasterClient.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly apiKey: string,
  ) {}

  async getAttractionEvents(
    attractionId: string,
    page = 0,
  ): Promise<TicketmasterEventsPage> {
    const { data } = await firstValueFrom(
      this.httpService.get(`${BASE_URL}/events.json`, {
        params: {
          attractionId,
          size: PAGE_SIZE,
          page,
          sort: 'date,asc',
          apikey: this.apiKey,
        },
      }),
    );

    const events = data?._embedded?.events ?? [];
    const pageInfo = data?.page ?? { totalPages: 0, totalElements: 0 };

    return {
      items: events.map(mapEvent),
      totalPages: pageInfo.totalPages,
      totalElements: pageInfo.totalElements,
    };
  }

  async getAllAttractionEvents(attractionId: string): Promise<SourceItem[]> {
    const firstPage = await this.getAttractionEvents(attractionId, 0);
    const allItems = [...firstPage.items];

    const maxPage = Math.min(
      firstPage.totalPages - 1,
      Math.floor(1000 / PAGE_SIZE) - 1, // deep paging cap
    );

    for (let page = 1; page <= maxPage; page++) {
      await delay(REQUEST_DELAY_MS);
      const nextPage = await this.getAttractionEvents(attractionId, page);
      allItems.push(...nextPage.items);
    }

    return allItems;
  }

  async searchAttractions(keyword: string): Promise<TicketmasterAttraction[]> {
    const { data } = await firstValueFrom(
      this.httpService.get(`${BASE_URL}/attractions.json`, {
        params: {
          keyword,
          size: 5,
          apikey: this.apiKey,
        },
      }),
    );

    const attractions = data?._embedded?.attractions ?? [];

    return attractions.map((a: { id: string; name: string }) => ({
      id: a.id,
      name: a.name,
    }));
  }
}

function mapEvent(event: Record<string, any>): SourceItem {
  const venue = event._embedded?.venues?.[0];
  const dateTime = event.dates?.start?.dateTime;
  const localDate = event.dates?.start?.localDate;
  const priceRange = event.priceRanges?.[0];

  return {
    externalId: event.id,
    title: event.name ?? '',
    url: event.url ?? '',
    ticketUrl: event.url ?? undefined,
    startAt: dateTime ? new Date(dateTime) : undefined,
    dateText: localDate ?? undefined,
    timezone: event.dates?.timezone ?? undefined,
    city: venue?.city?.name ?? undefined,
    country: venue?.country?.countryCode ?? undefined,
    venueName: venue?.name ?? undefined,
    latitude: venue?.location?.latitude
      ? parseFloat(venue.location.latitude)
      : undefined,
    longitude: venue?.location?.longitude
      ? parseFloat(venue.location.longitude)
      : undefined,
    priceMin: priceRange?.min ?? undefined,
    priceMax: priceRange?.max ?? undefined,
    currency: priceRange?.currency ?? undefined,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
