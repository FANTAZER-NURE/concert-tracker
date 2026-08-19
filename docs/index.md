# Concert Tracker wiki

NestJS API that will poll artist sources, turn announcements into events, and send Telegram alerts with location filters.

This folder is the project wiki. Scratch task files live in `/tasks` (gitignored). The original spec is [`REQUIREMENTS.md`](../REQUIREMENTS.md).

| Page | What it covers |
| --- | --- |
| [Local setup](local-setup.md) | Postgres, env, migrate, seed, run |
| [Architecture](architecture.md) | Modules, HTTP API, what is still missing |
| [Domain](domain.md) | Prisma models and how they relate |
| [Ingestion](ingestion.md) | Poll loop, Ticketmaster, event processing |
| [Roadmap](roadmap.md) | Spec steps 1–13 vs current code |
| [Status report](status.html) | Snapshot of where work stopped |
| [Progress](progress.md) | Live log while we finish the MVP |

## Stage (2026-08-18, after orchestrator run)

Ticketmaster poll → SourceEntry → Event (venue + continent) → subscription match → Notification. Telegram send is wired but no-ops without `TELEGRAM_BOT_TOKEN`.

Still open: second connector, bot commands, AI/websites, geocoding/radius, admin review, CI, deploy.

See [progress](progress.md).
