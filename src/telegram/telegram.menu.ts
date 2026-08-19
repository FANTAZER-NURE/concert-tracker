import type { ReplyButton } from './telegram.reply';

export const ADD_ARTIST_BUTTON: ReplyButton = {
  label: '➕ Add artist',
  data: 'menu:sub',
};

export const HOME_BUTTONS: ReplyButton[][] = [
  [ADD_ARTIST_BUTTON],
  [
    { label: '📋 My alerts', data: 'menu:list' },
    { label: '📅 Shows', data: 'menu:shows' },
  ],
  [
    { label: '❓ Help', data: 'menu:help' },
    { label: '⏸ Pause alerts', data: 'menu:stop' },
  ],
];

export const afterWatchButtons = (artistId: string): ReplyButton[][] => [
  [{ label: '📅 See shows', data: `shows:${artistId}` }],
  [{ label: '➕ Add another artist', data: 'menu:sub' }],
  [{ label: '📋 My alerts', data: 'menu:list' }],
];

export const MENU_BUTTON: ReplyButton = {
  label: '🏠 Menu',
  data: 'menu:home',
};

export const formatScope = (sub: {
  continent: string | null;
  country: string | null;
  city: string | null;
}) => {
  if (sub.city) {
    return sub.city;
  }
  if (sub.country) {
    return sub.country;
  }
  if (sub.continent) {
    return sub.continent;
  }
  return 'worldwide';
};

export const chunk = <T>(items: T[], size: number): T[][] => {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
};
