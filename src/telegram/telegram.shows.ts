export type ShowRow = {
  startAt: Date | null;
  dateText: string | null;
  city: string | null;
  country: string | null;
  ticketUrl: string | null;
  venue: { name: string } | null;
};

const formatDate = (show: ShowRow) => {
  if (show.startAt) {
    return show.startAt.toISOString().slice(0, 10);
  }
  return show.dateText ?? 'Date TBA';
};

const formatPlace = (show: ShowRow) => {
  const place = [show.city, show.venue?.name ?? show.country]
    .filter(Boolean)
    .join(', ');
  return place || 'Location TBA';
};

const formatShow = (show: ShowRow) => {
  const line = `${formatDate(show)} · ${formatPlace(show)}`;
  if (show.ticketUrl) {
    return `${line}\n${show.ticketUrl}`;
  }
  return line;
};

export const formatConcerts = (
  artistName: string,
  listing: {
    upcoming: ShowRow[];
    upcomingHasMore: boolean;
    recent: ShowRow[];
    recentHasMore: boolean;
  },
  refresh: { ok: boolean } = { ok: true },
) => {
  const blocks = [`🎤 ${artistName}`];

  if (listing.upcoming.length === 0 && listing.recent.length === 0) {
    if (!refresh.ok) {
      blocks.push(
        '',
        'Could not reach Ticketmaster. Nothing stored for this artist yet.',
      );
      return blocks.join('\n');
    }
    blocks.push(
      '',
      'I checked Ticketmaster just now. No upcoming or recent dates on that feed.',
      '',
      'The tour may be sold through another site, or Ticketmaster has not published it here.',
    );
    return blocks.join('\n');
  }

  if (listing.upcoming.length > 0) {
    blocks.push('', '📅 Upcoming', ...listing.upcoming.map(formatShow));
    if (listing.upcomingHasMore) {
      blocks.push('…more upcoming dates on Ticketmaster');
    }
  } else {
    blocks.push('', '📅 Upcoming', 'None on the calendar right now.');
  }

  if (listing.recent.length > 0) {
    blocks.push('', '🕑 Recent', ...listing.recent.map(formatShow));
    if (listing.recentHasMore) {
      blocks.push('…more past dates in the catalog');
    }
  }

  return blocks.join('\n');
};
