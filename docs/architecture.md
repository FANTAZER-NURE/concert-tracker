# Architecture

Single NestJS app. No workers, queues, frontend, or bot process.

```
Telegram user  (schema only)
      │
Subscriptions ──► (matching not built)
      │
Artists ── Sources ── IngestionService ── Ticketmaster Discovery API
                 │
            SourceEntry
                 │
         processSourceEntries()
                 │
               Event  ── Venue  (Venue unused at write time)
```

## Modules

| Module | Role |
| --- | --- |
| `AppConfigModule` | Zod-validated env, global ConfigModule |
| `DatabaseModule` | PrismaService |
| `ArtistsModule` | List + create |
| `SourcesModule` | List + create |
| `EventsModule` | List + create |
| `SubscriptionsModule` | List + create |
| `IngestionModule` | `@nestjs/schedule` interval + Ticketmaster HTTP client |

No `UsersModule`. `User` exists in Prisma and seed only.

No auth, rate limits, or request logging beyond Nest defaults.

## HTTP

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/artists` | All artists |
| POST | `/artists` | Create `{ name }` |
| GET | `/sources` | All sources |
| POST | `/sources` | Create source |
| GET | `/events` | All events |
| POST | `/events` | Manual event |
| GET | `/subscriptions` | All subscriptions |
| POST | `/subscriptions` | Create subscription |
| POST | `/ingestion/run` | One poll + process pass |
| GET | `/ingestion/artist/:artistName` | Ticketmaster attraction search |

CRUD is list and create only. Spec asks for update, deactivate, and artist merge. Those routes are not there.

## Libraries in use

- `@nestjs/schedule` for polling (in-process `@Interval(60_000)`, not a job queue)
- `@nestjs/axios` for Ticketmaster
- Zod for env and POST bodies

Not present: Bull/BullMQ, telegraf/grammy, OpenAI/LLM SDK, geocoder, embeddings, auth.

## Tests

Each module has `*.spec.ts` for controller and service, including Ticketmaster client and ingestion. `test/app.e2e-spec.ts` is the Nest starter e2e, not a pipeline test.
