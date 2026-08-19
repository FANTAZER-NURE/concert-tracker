# Ingestion

Work stopped here. Last commit (`94de3d9`) added `processSourceEntries()` after the Ticketmaster poll.

## Loop

`IngestionService.runScheduledPoll` runs every 60 seconds. It no-ops unless `NODE_ENV !== 'test'` and `UTC minutes % POLL_INTERVAL_MINUTES === 0`.

`POST /ingestion/run` calls `runPollOnce()` immediately:

1. Load all `isActive` sources
2. First `SourceConnector` whose `canHandle` matches → `fetch` → upsert `SourceEntry`
3. No connector → log and skip (no daily stubs)
4. `processSourceEntries()`

## Ticketmaster

`TicketmasterClient` hits Discovery v2:

- `GET /events.json?attractionId=` paginated, 50 per page, 210ms delay, cap ~1000 events
- `GET /attractions.json?keyword=` (used by `GET /ingestion/artist/:artistName`)

`mapEvent` fills `SourceItem` (title, dates, city, country code, venue, prices, ticket URL, lat/lng).

`pollTicketmaster` inserts a `SourceEntry` when `(sourceId, externalId)` is new. `confidence` is hardcoded `0.9`. Existing rows are skipped (no update if Ticketmaster changes a date).

Without `TICKETMASTER_API_KEY` the client is not constructed and Ticketmaster sources are skipped.

## Generic sources

Writes one stub per source per UTC day:

- `externalId = poll-YYYY-MM-DD`
- `title = Pending event from {source.name}`
- no `rawData`

Seed Instagram / X / Facebook sources hit this path.

## Processing (updated 2026-08-18, task 01)

For each `processed=false` entry:

| Condition | Result |
| --- | --- |
| No `artistId` | `processed=true`, `skipReason=missing_artist`, no event |
| `rawData` missing title, (startAt or dateText), city, or country | `processed=true`, `skipReason=missing_required_fields`, no event |
| Fields present | Upsert `Venue` from `venueName`, set continent from ISO-2 map, `Event.create`, set `eventId` |

Query skipped inbox rows with `processed=true AND eventId=null`.

## Remaining holes

- Event dedup (task 03): same artistId + city (trim/lowercase) + UTC day of startAt, or dateText fallback
- No retries, backoff, or per-source rate limit beyond Ticketmaster’s 210ms delay
- Poll is in-process; two app instances would double-write
- Connector dispatch is `SOURCE_CONNECTORS` + first `canHandle` (task 02 done). Ticketmaster is the only connector.
- Seed Eminem / RHCP attraction ids have 0 upcoming Ticketmaster events as of 2026-08-18. Kansas `K8vZ9171C-f` does.
