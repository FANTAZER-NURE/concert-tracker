export type SubscriptionRegion = {
  code: string;
  label: string;
  emoji: string;
  continent: string | null;
};

export const SUBSCRIPTION_REGIONS: SubscriptionRegion[] = [
  { code: 'WW', label: 'Worldwide', emoji: '🌐', continent: null },
  { code: 'NA', label: 'North America', emoji: '🌎', continent: 'North America' },
  { code: 'EU', label: 'Europe', emoji: '🌍', continent: 'Europe' },
  { code: 'AS', label: 'Asia', emoji: '🌏', continent: 'Asia' },
  { code: 'SA', label: 'South America', emoji: '🌴', continent: 'South America' },
  { code: 'AF', label: 'Africa', emoji: '🦁', continent: 'Africa' },
  { code: 'OC', label: 'Oceania', emoji: '🌊', continent: 'Oceania' },
];

export const regionByCode = (code: string): SubscriptionRegion | null =>
  SUBSCRIPTION_REGIONS.find((region) => region.code === code) ?? null;
