# Daymark

Daymark is a private-by-default habit tracker built as a standalone Next.js web/PWA app.

It uses the Next.js App Router, React Query, Drizzle + libSQL, Better Auth, Tailwind v4,
shadcn-style UI components, Recharts, Zod, and Vitest. This repo does **not** contain
Firebase, Expo, or native app code.

## Product boundaries

Daymark is built around privacy and consent:

- Accounts use Better Auth email/password sessions. All workspace reads and writes are
  scoped to the signed-in user.
- Habit data is private by default. Nothing is shared through a circle invite, join, or
  partner connection by itself.
- Partner and circle invitations use exact email addresses and signed-in acceptance.
- Sharing requires an explicit preview and field-level grant. Revoking a grant removes
  access.
- Weekly review notes stay private.
- Block and mute boundaries are symmetric. Removed or departed members' support activity
  stays removed.
- Reminders are honest in-app nudges; snooze/dismiss are session-only.
- Public challenge discovery is signed-in only and closed unless both moderator
  environment values are configured. There are no public profiles, user search, DMs,
  leaderboards, participant names, progress feeds, or rankings.
- Moderator access is an environment allowlist, never a self-assigned role.
- Full JSON restore is transactional and clears stale offline logs. Account deletion is
  transactional and removes owned/social records.

Status meaning in the grid:

- `✔` complete
- `✗` missed
- `⚠` excused — outside your control and excluded from scoring; stored as a skip
  exception, not as partial progress
- `◐` partial, where partial tracking is explicitly supported

## Quick start

```bash
corepack pnpm install
cp .env.example .env.local
corepack pnpm db:migrate
corepack pnpm dev
```

Then open <http://localhost:3000>, register, and choose either the starter set or an
empty grid during onboarding.

Generate a real auth secret with:

```bash
openssl rand -base64 32
```

`BETTER_AUTH_URL` must match the origin you actually browse. If Next.js moves from port
3000 to 3001, update that value before signing in.

Never commit `.env.local`, real secrets, local databases, or database backups.

## Environment

| Variable | Purpose |
| --- | --- |
| `TURSO_DATABASE_URL` | `file:local.db` for local development, or a hosted `libsql://...` URL |
| `TURSO_AUTH_TOKEN` | Auth token for hosted libSQL/Turso; leave empty for local files |
| `BETTER_AUTH_SECRET` | Required random secret for signing sessions |
| `BETTER_AUTH_URL` | Exact app origin, including scheme and port |
| `MODERATOR_EMAILS` | Comma-separated exact account emails allowed to moderate; leave empty to keep discovery closed |
| `MODERATOR_CONTACT_EMAIL` | Public contact address shown in community rules; leave empty to keep discovery closed |

Public discovery stays closed while either `MODERATOR_EMAILS` or
`MODERATOR_CONTACT_EMAIL` is empty. When both are set, only allowlisted accounts can
approve challenges or review reports. Moderator emails are read server-side only and
are never sent to the browser.

For production, set the exact public origin, use a hosted database with a real backup
procedure, run migrations, then build and start:

```bash
corepack pnpm db:migrate
corepack pnpm build
corepack pnpm start
```

The included `db:backup` and `db:restore` scripts support local `file:` databases only.
Hosted databases need their provider's snapshot/backup tooling.

## Scripts

| Script | Purpose |
| --- | --- |
| `corepack pnpm dev` | Development server |
| `corepack pnpm build` | Production build |
| `corepack pnpm start` | Production server |
| `corepack pnpm typecheck` | `tsc --noEmit` |
| `corepack pnpm lint` | ESLint |
| `corepack pnpm test` | Vitest suite |
| `corepack pnpm test:watch` | Vitest watch mode |
| `corepack pnpm db:generate` | Generate Drizzle migrations after schema changes |
| `corepack pnpm db:migrate` | Apply Drizzle migrations |
| `corepack pnpm db:studio` | Drizzle Studio |
| `corepack pnpm db:backup` | Copy the local SQLite database into `.backups/` |
| `corepack pnpm db:restore <file>` | Restore a local SQLite database backup |

## Main routes

- Public: `/`, `/login`, `/register`, `/offline`
- Onboarding: `/onboarding`
- Workspace: `/app`, `/app/today`, `/app/grid`, `/app/habits`, `/app/habits/[habitId]`,
  `/app/analytics`, `/app/privacy`, `/app/settings`
- Accountability: `/app/accountability` and invite acceptance routes
- Circles: `/app/circles` and circle/invite routes
- Discovery/moderation: `/app/discover`, `/app/moderation`
- APIs: `/api/auth/*`, `/api/workspace/*`, `/api/health`, `/api/account`
- Exports: `/api/workspace/export` for CSV and
  `/api/workspace/export?format=json` for full workspace JSON
- Import: `POST /api/workspace/import` for transactional JSON restore

## Architecture

- `src/domain` — framework-free types, calculations, schedule rules, backup parsing,
  defaults, and CSV generation.
- `src/server` — Better Auth config, Drizzle schema/client/DAL, auth guards, and HTTP
  error helpers. Route handlers call `requireSession()`; moderators are checked with
  `requireModerator()`.
- `src/app` — App Router pages and route handlers.
- `src/lib/hooks` — React Query hooks with user-scoped cache keys and optimistic writes.
- `src/stores` — persisted offline queue; it stores no credentials and is cleared on
  sign-out.
- `src/components` — app shell, grid, charts, forms, marketing page, and copied UI
  primitives.

Authentication is enforced by a fast cookie check in `proxy.ts`, live
`requireSession()` checks in server layouts and route handlers, and tenant-scoped DAL
queries. The proxy is never treated as sufficient on its own.

## Offline behavior

Grid taps update the UI immediately. If a write fails, the change is queued in
localStorage, a toast explains what happened, and the queue is flushed on the next
`online` event or page load. Signing out discards the queue and clears the query cache.
Web push notifications are intentionally unavailable.

## Reference docs

- [Folio reuse notes](docs/FOLIO-REUSE.md)
- [Test seams](docs/TEST-SEAMS.md)
- [Daymark integration plan](docs/DAYMARK-INTEGRATION-PLAN.md) — historical reskin/design
  plan, not a launch checklist
