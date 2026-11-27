# What we reused from folio

This repo is a fresh standalone rewrite of the Expo app `PROJECT-365` on folio's web
stack. `folio_tracker` was treated as read-only reference. Below is the reusable
surface we copied and what we changed or deliberately left behind.

## Copied directly (then re-themed)

| Area | Files / pattern | What carried over |
| --- | --- | --- |
| Toolchain | `package.json`, `tsconfig.json`, `postcss.config.mjs`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.mts`, `drizzle.config.ts`, `pnpm-workspace.yaml`, `scripts/db-*.mjs` | Next.js 16 App Router, Tailwind v4, shadcn/Radix, Drizzle + libSQL, Vitest, strict TypeScript with `noUncheckedIndexedAccess`. |
| UI primitives | `src/components/ui/*` | Button, Card, Input, Label, Badge, Dialog, Select, Separator, Switch, Skeleton, Sonner toaster, Tooltip, Recharts `ChartContainer`. Only the pieces this app needs remain in the tree. |
| Providers | `src/components/providers/theme-provider.tsx`, `query-provider.tsx` | `next-themes` class provider; one browser-scoped QueryClient, online/offline tracking, and a safe post-mount Zustand rehydrate. |
| Query layer | `src/lib/query/query-client.ts`, `query-keys.ts` | 60s stale / 10m GC, no retries on 4xx, and **user-scoped key factory** (`["workspace", userId, ...]`) so sign-out can't leak another tenant's cached data. |
| Auth plumbing | `src/server/auth.ts`, `src/lib/auth-client.ts`, `src/app/api/auth/[...all]/route.ts`, `src/proxy.ts`, `src/server/dal/auth-guard.ts` | Better Auth + Drizzle adapter, `toNextJsHandler`, `getSessionCookie` proxy redirect, and defence-in-depth `requireSession()` in every page/DAL/route. |
| DB layer | `src/server/db/client.ts`, `schema/*` | libSQL client singleton, foreign keys + WAL for local files, ULID defaults, `DbExecutor` abstraction for transactions. |
| HTTP layer | `src/server/http/responses.ts`, `src/server/dal/errors.ts` | Zod/DalError → structured `{ error: { code, message } }` responses; `readJson<T>()` helper. |
| Security helpers | `src/lib/redirect.ts`, CSP/security headers in `next.config.ts` | Strict same-origin `callbackURL` sanitizer, private/no-store headers on `/app` and `/api`, service worker headers. |
| PWA | `src/components/pwa/service-worker-registrar.tsx`, `public/sw.js`, `src/app/manifest.ts` | Idle registration, public-only offline navigation fallback, never caching private responses. |

## Deliberately different

- **Palette and brand.** folio's Warm Paper / Carbon Ink and warm accent tokens were
  replaced with the original PROJECT_365 purple (`#7C5CFC`), green/amber/red status
  colours, and dark `#0F0F17` surface. The icon and manifest are PROJECT_365.
- **Auth.** Email/password only, no email verification, no OAuth, no self-assigned
  roles, no suspension policy, no rate-limit Redis. Registration no longer depends
  on any Firestore write — Better Auth's user row is created first, preferences are
  lazily ensured, and onboarding happens afterwards. The only privileged access is
  a server-side `MODERATOR_EMAILS` allowlist gating the review queue.
- **Data model.** Instead of folio's tasks/notes/projects/reminders, the schema is
  habits, habit logs, monthly snapshots, and user preferences, plus social tables
  for invite-only circles and moderation-gated public challenges. Snapshots are
  JSON payloads rebuilt from raw logs and invalidated on every write.
- **Offline queue.** folio's server-side reminders/web-push stack is gone. Failed log
  writes are queued in a persisted Zustand store, retried on reconnect, shown with
  toasts, and always discarded on sign-out.
- **Notifications.** Web push is not ported. The reminder-time preference is kept for
  compatibility but the settings UI is explicitly disabled and explains why.
- **Splash.** folio's PWA launch splash was not copied, so there is no timeout that can
  get stuck in front of the app. Loading uses route-level skeletons instead.
- **Theme toggle.** Both sun and moon icons are always rendered and CSS chooses the
  visible one, avoiding the next-themes SSR/hydration mismatch that can flash or
  regenerate the tree on first paint.
- **No landing guard / Inngest jobs / email dispatcher.** Those folio subsystems
  have no counterpart in PROJECT_365. Circles and moderated public discovery are
  original: invite-only by exact email, and public challenges are standalone,
  anonymous aggregate intentions with no public profiles or direct messages.

## UI and correctness fixes folded in

1. **No stuck splash or loading gate** — skeletons and explicit error/retry cards.
2. **Optimistic grid writes** — cell taps update React Query immediately; failures
   enqueue locally and produce a visible error toast. Mutations use
   `networkMode: "always"` so React Query cannot silently pause an offline write;
   server-side rejections roll back while offline taps stay visible as pending.
3. **Fresh dashboard snapshot** — snapshot cache is invalidated after log writes and a
   manual refresh button deletes the cached snapshot before refetching.
4. **Decoupled registration** — account creation succeeds independently of Firestore
   or any second write; onboarding is a separate step.
5. **Responsive layout** — fixed desktop sidebar, mobile bottom nav, horizontally
   scrollable habit grid, and stacked cards on small screens.
6. **Consistent empty states** — dashboard, grid, habits, detail, analytics, and
   settings each have an actionable empty/error state instead of a blank view.
7. **Real CSV download** — `/api/workspace/export` streams a quoted, sorted CSV with
   an attachment header; settings triggers a real browser download.
8. **Non-blocking sign-out** — auth sign-out, local cache clear, and navigation always
   proceed; a failed offline queue flush can never hold the user inside the app.

## Patterns worth reusing in future folio work

- User-scoped query keys plus `queryClient.clear()` on sign-out.
- Session resolution in the DAL rather than trusting the proxy cookie check.
- `readJson` + Zod at every HTTP boundary, with structured error codes.
- Persisted non-PII UI state rehydrated only after mount to avoid hydration mismatch.
- Service worker that caches only public assets and falls back on navigation failure.
