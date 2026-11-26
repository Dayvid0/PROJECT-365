# PROJECT_365 Web

A standalone web/PWA rewrite of the original Expo habit tracker, on folio's stack:
Next.js 16 App Router, React Query, Drizzle + libSQL, Better Auth, Tailwind v4,
shadcn/ui, Recharts, Zod, and Vitest.

This repo does **not** contain Firebase, Expo, or native code. It starts with an
empty local database and the 25 original starter habits are offered at onboarding.

## Setup

```bash
corepack pnpm install
cp .env.example .env.local   # then set a real BETTER_AUTH_SECRET
corepack pnpm db:generate     # only needed when the schema changes
corepack pnpm db:migrate
corepack pnpm dev
```

Open <http://localhost:3000>, register, choose the starter set or an empty grid,
and start tapping cells.

Local env files and SQLite databases are gitignored. Never commit `.env.local`.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js development, production build, production server |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Domain-level Vitest suite |
| `pnpm lint` | ESLint |
| `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:studio` | Drizzle migrations |
| `pnpm db:backup` / `pnpm db:restore <file>` | Copy/restore the local SQLite file |

## Routes

- `/` landing, `/login`, `/register`
- `/onboarding` starter-set choice (first sign-in only)
- `/app` dashboard, `/app/grid`, `/app/habits`, `/app/habits/[habitId]`,
  `/app/analytics`, `/app/accountability`, `/app/circles`, `/app/settings`
- `/api/auth/*` Better Auth, `/api/workspace/*` authenticated workspace REST,
  `/api/health`, `/api/workspace/export` CSV download, `/api/account` permanent deletion
- `/offline` PWA fallback page

## Architecture

- `src/domain` — pure, framework-free types, calculations, defaults, validation, CSV.
- `src/server` — Better Auth config, Drizzle schema/DAL, and HTTP error helpers.
  Every route handler calls `requireSession()` and scopes queries by `user.id`.
- `src/lib/hooks` — React Query hooks with optimistic log writes, visible errors,
  and user-scoped cache keys.
- `src/stores` — persisted offline queue (no credentials), cleared on sign-out.
- `src/components` — AppShell/nav, habit grid, charts, forms, and copied shadcn UI.

Authentication is enforced three ways: a fast cookie check in `proxy.ts`, a live
`requireSession()` in server layouts and route handlers, and tenant-scoped DAL
queries. The proxy is never treated as sufficient on its own.

## Offline behaviour

Grid taps update the UI immediately. If the write fails, the change is queued in
localStorage, a toast explains what happened, and the queue is flushed on the next
`online` event or page load. Signing out discards the queue and clears the query
cache. Web push notifications are intentionally unavailable.

## Reuse notes

See [docs/FOLIO-REUSE.md](docs/FOLIO-REUSE.md) for the exact folio patterns copied,
adapted, or deliberately omitted, and [docs/TEST-SEAMS.md](docs/TEST-SEAMS.md) for
the public interfaces the tests exercise.
