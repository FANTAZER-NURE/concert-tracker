# Local setup

## Stack

- NestJS 11, Prisma 6, PostgreSQL 16, Zod 4
- Package manager: Yarn (`yarn.lock` is in the repo)

## Run

```bash
docker compose up -d
cp .env.example .env
# add TICKETMASTER_API_KEY if you want live polls
npx prisma migrate deploy
yarn seed
yarn start:dev
```

API listens on `PORT` (default 3000).

## Env

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Matches `docker-compose.yml` in `.env.example` |
| `PORT` | no | Default 3000 |
| `POLL_INTERVAL_MINUTES` | no | Default 60. Scheduler ticks every 60s and runs when `UTC minutes % interval === 0` |
| `TICKETMASTER_API_KEY` | no | Without it, Ticketmaster sources are skipped |
| `TELEGRAM_BOT_TOKEN` | no | Without it, the bot does not poll and sends stay PENDING |
| `NODE_ENV` | no | Auto-schedule and Telegram polling are off when `test` |

`.env.example` does not list `TICKETMASTER_API_KEY` yet. `config.module.ts` accepts it as optional.

## Seed

`prisma/seed.ts` upserts:

- User `telegramId=test-telegram-1`
- Artists **Eminem** and **Red Hot Chili Peppers**
- Social sources (Instagram, X, Facebook) plus a Ticketmaster `EVENT_API` source with attraction ids
- One NA / US subscription per artist

Social sources have no connector. The generic poller writes a stub `SourceEntry` per source per UTC day, then the processor marks it processed without creating an event.

## Tests

Do not run these here unless you want to. From the repo root:

```bash
yarn test
yarn test:e2e
```
