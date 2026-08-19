const COUNTRY_TO_CONTINENT: Record<string, string> = {
  US: 'North America',
  CA: 'North America',
  MX: 'North America',
  GB: 'Europe',
  DE: 'Europe',
  FR: 'Europe',
  IT: 'Europe',
  ES: 'Europe',
  NL: 'Europe',
  AU: 'Oceania',
  NZ: 'Oceania',
  JP: 'Asia',
  KR: 'Asia',
  CN: 'Asia',
  BR: 'South America',
  AR: 'South America',
  ZA: 'Africa',
};

export const continentFromCountry = (
  country?: string | null,
): string | null => {
  if (!country) {
    return null;
  }

  return COUNTRY_TO_CONTINENT[country.toUpperCase()] ?? null;
};
