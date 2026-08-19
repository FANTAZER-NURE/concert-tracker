# Domain

Prisma models in `prisma/schema.prisma`. Two migrations:

1. `20260208190257_init` — core tables
2. `20260315191857_add_source_entry_raw_data_and_processed` — `SourceEntry.rawData` (Json) and `processed` (Boolean)

## Models

**Artist** — unique `name`, `isActive`. Users add one by typing a name in Telegram. We resolve the catalog first, then Ticketmaster, and attach a Ticketmaster source when we get an attraction id.

**Source** — optional `artistId` (global sources are allowed), `SourceType` (`EVENT_API | WEBSITE | SOCIAL | SEARCH | FEED`), `url`, `externalId`. Ticketmaster uses `externalId` as the attraction id.

**SourceEntry** — one fetched item. Unique `(sourceId, externalId)`. Holds `rawData`, `contentHash`, `confidence`, `processed`, optional `eventId`. This is the ingestion inbox.

**Event** — confirmed (or at least persisted) show. Location fields live on the event itself (`city`, `country`, `continent`) and optionally on `Venue`. Processor writes city/country from Ticketmaster and skips continent and `venueId`.

**Venue** — name + city/country/continent + lat/lng. Schema is ready. Nothing creates venues yet. Ticketmaster mapping already has `venueName`, `latitude`, `longitude` on `SourceItem`.

**User** — keyed by `telegramId`. Created or updated on Telegram `/start`. `/stop` sets `isActive` false and matching skips that user.

**Subscription** — user + artist + optional continent/country/city/`radiusKm`. Unique on that tuple. The bot creates worldwide or continent-scoped rows. Matching writes `Notification` rows for active users.

## Gaps vs the spec

- No merge of artist identities
- No source trust tier or rate-limit fields
- No review-queue model for low-confidence events
- No notification / delivery log
- `contentHash` is unused
- Processor can mark an entry `processed=true` with no `eventId` (incomplete rows are discarded)
