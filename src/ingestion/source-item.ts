export type SourceItem = {
  externalId: string;
  url: string;
  title: string;
  startAt?: Date;
  dateText?: string;
  timezone?: string;
  city?: string;
  country?: string;
  venueName?: string;
  ticketUrl?: string;
  priceMin?: number;
  priceMax?: number;
  currency?: string;
  latitude?: number;
  longitude?: number;
};
