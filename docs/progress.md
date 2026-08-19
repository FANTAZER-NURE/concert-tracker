# Progress log

Orchestrator chat updates this after each task. Task files live in `/tasks` (gitignored).

| Task | Status | Notes |
| --- | --- | --- |
| [01 Fix processing](../tasks/01-fix-processing.md) | done | Venues + continent + skipReason. Live: 31 Kansas events all have venueId and continent |
| [02 Connector interface](../tasks/02-connector-interface.md) | done | SOURCE_CONNECTORS + TicketmasterConnector. Generic daily stubs removed |
| [03 Event identity / dedup](../tasks/03-event-dedup.md) | done | Same artist + UTC day + city reuses Event. Live clone matched |
| [04 Subscription matching](../tasks/04-subscription-matching.md) | done | POST /ingestion/run returns matches. Live: 1 Kansas match on reused event |
| [05 Telegram delivery](../tasks/05-telegram-delivery.md) | done | No token: sent=0 skipped=1, Notification stays PENDING |
| 05 Telegram delivery | queued | No bot token in `.env` yet |

## Env (2026-08-18)

- `concert-tracker-postgres` is up on 5432 (Postgres 16, not MySQL)
- `.env` has `TICKETMASTER_API_KEY`
- No `TELEGRAM_BOT_TOKEN`
- API was down on :3000 at session start
