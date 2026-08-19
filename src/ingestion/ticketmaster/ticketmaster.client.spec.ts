import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { HttpService } from '@nestjs/axios';
import { TicketmasterClient } from './ticketmaster.client';

const MOCK_EVENT = {
  id: 'G5diZfkn0B-bh',
  name: 'Eminem Live 2026',
  url: 'https://www.ticketmaster.com/eminem-live-2026',
  dates: {
    start: {
      dateTime: '2026-07-15T19:00:00Z',
      localDate: '2026-07-15',
    },
    timezone: 'America/New_York',
  },
  priceRanges: [{ min: 75.0, max: 350.0, currency: 'USD' }],
  _embedded: {
    venues: [
      {
        name: 'Madison Square Garden',
        city: { name: 'New York' },
        country: { countryCode: 'US' },
        location: { latitude: '40.7505', longitude: '-73.9934' },
      },
    ],
  },
};

const MOCK_EVENT_MINIMAL = {
  id: 'G5diZfkn0B-xx',
  name: 'Eminem TBA Show',
  url: 'https://www.ticketmaster.com/eminem-tba',
  dates: {
    start: {
      localDate: '2026-09-01',
    },
  },
  _embedded: {},
};

function axiosResponse(data: unknown): AxiosResponse {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: {} },
  } as AxiosResponse;
}

function mockHttpService(response: AxiosResponse) {
  return {
    get: jest.fn().mockReturnValue(of(response)),
  } as unknown as HttpService;
}

describe('TicketmasterClient', () => {
  describe('getAttractionEvents', () => {
    it('maps a full Ticketmaster event to SourceItem', async () => {
      const httpService = mockHttpService(
        axiosResponse({
          _embedded: { events: [MOCK_EVENT] },
          page: { totalPages: 1, totalElements: 1 },
        }),
      );

      const client = new TicketmasterClient(httpService, 'test-key');
      const result = await client.getAttractionEvents('K8vZ9171oZ7');

      expect(result.totalPages).toBe(1);
      expect(result.totalElements).toBe(1);
      expect(result.items).toHaveLength(1);

      const item = result.items[0];
      expect(item.externalId).toBe('G5diZfkn0B-bh');
      expect(item.title).toBe('Eminem Live 2026');
      expect(item.url).toBe('https://www.ticketmaster.com/eminem-live-2026');
      expect(item.ticketUrl).toBe(
        'https://www.ticketmaster.com/eminem-live-2026',
      );
      expect(item.startAt).toEqual(new Date('2026-07-15T19:00:00Z'));
      expect(item.dateText).toBe('2026-07-15');
      expect(item.timezone).toBe('America/New_York');
      expect(item.city).toBe('New York');
      expect(item.country).toBe('US');
      expect(item.venueName).toBe('Madison Square Garden');
      expect(item.latitude).toBe(40.7505);
      expect(item.longitude).toBe(-73.9934);
      expect(item.priceMin).toBe(75.0);
      expect(item.priceMax).toBe(350.0);
      expect(item.currency).toBe('USD');
    });

    it('handles event with minimal fields', async () => {
      const httpService = mockHttpService(
        axiosResponse({
          _embedded: { events: [MOCK_EVENT_MINIMAL] },
          page: { totalPages: 1, totalElements: 1 },
        }),
      );

      const client = new TicketmasterClient(httpService, 'test-key');
      const result = await client.getAttractionEvents('K8vZ9171oZ7');
      const item = result.items[0];

      expect(item.externalId).toBe('G5diZfkn0B-xx');
      expect(item.title).toBe('Eminem TBA Show');
      expect(item.startAt).toBeUndefined();
      expect(item.dateText).toBe('2026-09-01');
      expect(item.city).toBeUndefined();
      expect(item.country).toBeUndefined();
      expect(item.venueName).toBeUndefined();
      expect(item.priceMin).toBeUndefined();
    });

    it('returns empty items when no events in response', async () => {
      const httpService = mockHttpService(
        axiosResponse({
          page: { totalPages: 0, totalElements: 0 },
        }),
      );

      const client = new TicketmasterClient(httpService, 'test-key');
      const result = await client.getAttractionEvents('K8vZ9171oZ7');

      expect(result.items).toHaveLength(0);
      expect(result.totalPages).toBe(0);
    });

    it('passes correct query parameters', async () => {
      const httpService = mockHttpService(
        axiosResponse({
          _embedded: { events: [] },
          page: { totalPages: 0, totalElements: 0 },
        }),
      );

      const client = new TicketmasterClient(httpService, 'my-api-key');
      await client.getAttractionEvents('ATTRACT-1', 2);

      expect(httpService.get).toHaveBeenCalledWith(
        expect.stringContaining('/events.json'),
        {
          params: {
            attractionId: 'ATTRACT-1',
            size: 50,
            page: 2,
            sort: 'date,asc',
            apikey: 'my-api-key',
          },
        },
      );
    });

    it('throws on HTTP error', async () => {
      const httpService = {
        get: jest.fn().mockReturnValue(
          throwError(() => ({
            response: { status: 401, data: { fault: 'Invalid ApiKey' } },
          })),
        ),
      } as unknown as HttpService;

      const client = new TicketmasterClient(httpService, 'bad-key');
      await expect(
        client.getAttractionEvents('K8vZ9171oZ7'),
      ).rejects.toBeDefined();
    });
  });

  describe('searchAttractions', () => {
    it('returns attraction id and name', async () => {
      const httpService = mockHttpService(
        axiosResponse({
          _embedded: {
            attractions: [
              {
                id: 'K8vZ9171oZ7',
                name: 'Eminem',
                upcomingEvents: { _total: 4 },
              },
              { id: 'K8vZ917abc', name: 'Eminem Tribute' },
            ],
          },
        }),
      );

      const client = new TicketmasterClient(httpService, 'test-key');
      const results = await client.searchAttractions('Eminem');

      expect(results).toEqual([
        { id: 'K8vZ9171oZ7', name: 'Eminem', upcomingCount: 4 },
        { id: 'K8vZ917abc', name: 'Eminem Tribute', upcomingCount: 0 },
      ]);
    });

    it('returns empty array when no attractions found', async () => {
      const httpService = mockHttpService(
        axiosResponse({ page: { totalElements: 0 } }),
      );

      const client = new TicketmasterClient(httpService, 'test-key');
      const results = await client.searchAttractions('NonExistentArtist');

      expect(results).toEqual([]);
    });
  });
});
