# Roadmap

Mapped from [`REQUIREMENTS.md`](../REQUIREMENTS.md) “Approximate Implementation Steps” against the repo on 2026-08-18.

| # | Spec step | Status | Notes |
| --- | --- | --- | --- |
| 1 | Nest workspace, config, lint, CI | Partial | App, Zod config, ESLint/Prettier exist. No CI. |
| 2 | Domain model | Partial | Artists, sources, entries, events, venues, users, subscriptions. No review queue or delivery log. |
| 3 | Core services | Partial | List + create only. No update, deactivate, merge. No Users API. |
| 4 | Ingestion framework | Partial | Connector interface + interval poll. No queue or retries. |
| 5 | Initial connectors | Partial | Ticketmaster only. |
| 6 | AI pipeline | Not started | Ticketmaster is already structured JSON. |
| 7 | Normalization / geocoding | Partial | Venue upsert + ISO-2 continent map. No geocoder or radius. |
| 8 | Dedup | Partial | Artist + UTC day + city. No embeddings. |
| 9 | Notification engine | Partial | Matching + Notification rows on each ingestion run. |
| 10 | Telegram bot | Partial | Sender exists; no token, no bot commands. |
| 11 | Admin review | Not started | |
| 12 | Observability and tests | Partial | Unit specs exist. No metrics, dashboards, or announcement regression set. |
| 13 | Deployment | Not started | Compose is Postgres only. |

## Suggested order when you resume

1. Fix processing holes (venues, don’t discard incomplete entries, event dedup key).
2. Introduce a connector interface so the next source is not another `if (name === ...)`.
3. Add one more structured API (Bandsintown or Songkick) before websites or LLM.
4. Match new events to subscriptions and send one Telegram message.
5. Then websites / LLM extraction, admin queue, CI, deploy.

AI work is later than the spec list implies. Ticketmaster already returns structured events. LLM pays off on websites and social posts, which have no fetchers yet.
