# Daymark integration plan

## Goal

Rename the app from **PROJECT_365** to **Daymark** and adopt the Daymark visual language while keeping the current Next.js application, data model, auth, and privacy/safety guarantees intact.

This plan treats the supplied zips as a **design specification**, not as code to merge.

## Source review

- `daymark (1).zip` and `daymark (2).zip` are byte-identical. SHA-256 for both:
  `7cd47b747cbbc51a3458ce0c681bfdf80648d53b3e33b76896ecf45196f58e0a`
- Extracted for review at `/tmp/opencode/daymark-review` (temporary, not in the repo).
- The zip is a Vite/React/Express/tRPC starter with a polished marketing page and a clickable design prototype:
  - `client/src/App.tsx` routes only `/`, `/prototype`, and 404.
  - `server/routers.ts` exposes only system health/auth.
  - `drizzle/schema.ts` contains only a MySQL `users` table.
  - `TODO.md` explicitly labels the product screens design-only.
- There is no habit/log/share/circle/moderation backend in the zip. All prototype actions are local state or toasts.

## Architectural decision

**Do not port the Daymark backend or runtime.**

Keep:

- Next.js 16 App Router and React 19.
- Better Auth email/password sessions.
- Drizzle + libSQL schema and migrations.
- Server-side `requireSession()` / `requireModerator()` guards.
- REST route handlers under `/api/workspace/*`.
- React Query hooks and the offline pending-log queue.
- Domain layer, Zod validation, and Vitest suite.

Discard:

- Vite, wouter, tRPC, Express.
- Manus OAuth, `webdev_app_session`, `SameSite=None` cookies, and the `sessionStorage` bearer fallback.
- MySQL `users` table, `role: admin`, and `OWNER_OPEN_ID`.
- AI, image-generation, map, storage, notification, voice, data API, heartbeat, and debug collector helpers.
- Duplicated global CSS and external Google Fonts imports.

## Non-negotiables

Any reskin must preserve these behaviours exactly:

1. Private by default; no habit data is shared without explicit preview and grant.
2. Partner/circle invitations work by exact email and signed-in acceptance.
3. Joining a circle shares nothing; only active circle-scoped grants are visible to current members.
4. Circle reactions/comments/challenges stay circle-local and anonymous-count based where applicable.
5. Block/mute boundaries are symmetric; removed/left members' support activity remains removed.
6. Weekly review notes never enter `ShareGrant`.
7. Web reminders remain honest in-app nudges; snooze/dismiss stay session-only.
8. Full JSON restore stays transactional and clears stale offline logs.
9. Public discovery is signed-in only and gated by both `MODERATOR_EMAILS` and `MODERATOR_CONTACT_EMAIL`.
10. Discovery exposes only title, summary, category, dates, aggregate participant count, viewer join state, status, and creation time.
11. No public profiles, user search, direct messages, leaderboards, participant names, progress feeds, or rankings.
12. Moderator access remains an environment allowlist, never a self-assigned role.
13. Account deletion remains transactional and clears all owned/social records.

## Visual system to translate

Take these as design inputs, not literal CSS to paste:

| Daymark element | Target treatment |
| --- | --- |
| Ink `#181c17`, paper `#fffef9`, cream `#f5f4ed` | shadcn/Tailwind background and foreground tokens |
| Lime `#d8f269` | Primary accent for actions, active nav, progress |
| Coral `#d58a65`, sage/blue tints | Status and habit-category accents |
| DM Sans + Newsreader | Self-host with `next/font`; no runtime Google Fonts request |
| 5–9px radii, thin borders, restrained orbit/card motion | Base card/button/input tokens with reduced-motion support |
| Hero/sidebar/content density | Adapted to our existing responsive shell |

Do **not** copy the prototype's 7–10px body text. Raise real product text to accessible sizes (roughly 13–16px for body, larger for headings) while preserving the tight visual hierarchy.

## Phase 0 decisions (approved)

1. **Theme default:** paper-light first. Dark mode will be remapped deliberately in Phase 2; Phase 1 leaves the runtime theme unchanged so the rename stays behavior-neutral.
2. **Brand/legal:** the Daymark name and supplied mark are cleared for use.
3. **Landing imagery:** use licensed stock with attribution, sourced in Phase 3.
4. **Copy survive list:** reject “beta not open,” “community not live,” “actions don't save,” and “no signup live” because our app already has those features.
5. **Scope:** visual-only reskin first; new Daymark concepts stay in later phases.
6. **Package name:** `daymark-web`.
7. **Compatibility identifiers intentionally unchanged:** the backup format string, persisted offline/timer storage keys, service-worker cache name, redirect sentinel host, and DB global symbol. They are not user-facing brand and changing them could orphan existing data.

---

## Phase 0 — Decisions and asset gate

**Effort:** 0.5 day  
**Outcome:** approved brand/copy/assets before code changes.

- Confirmed the Daymark name and supplied mark are cleared for use.
- Chose licensed stock with attribution for the landing page.
- Confirmed fonts will be self-hosted with `next/font`; licensing is checked before Phase 2.
- Produced the copy audit: keep compassionate language, remove prototype-fiction claims.
- Chose paper-light first with a deliberate dark remap in Phase 2.
- Renamed `package.json` to `daymark-web`.

**Exit criteria:** no unresolved legal/brand/copy blockers.

---

## Phase 1 — Brand rename foundation

**Effort:** 0.5–1 day  
**Risk:** low; no DB migration.

Likely files:

- `src/lib/constants.ts` — `APP_NAME`, `APP_TAGLINE`.
- `src/components/shell/app-shell.tsx` — visible brand text.
- `src/app/manifest.ts` — name, short name, theme/background colours.
- `src/app/icon.svg` / `public/icons/*` — replace mark and regenerate PNGs.
- `src/app/layout.tsx` and page metadata — titles/robots copy.
- `src/app/api/health/route.ts` — health payload app name.
- `src/app/api/workspace/export/route.ts` — export filenames.
- `README.md`, `docs/*`, package name, onboarding/privacy copy.

Compatibility rule: **do not change the JSON backup schema.** Filename changes are fine; restore must keep working with old backups.

**Exit criteria:** app builds and runs as Daymark everywhere; old backups still restore.

---

## Phase 2 — Design tokens and base components

**Effort:** 0.5–1 day  
**Risk:** medium if shadcn tokens are not mapped carefully.

- Translate Daymark palette, radius, spacing, and type into `src/app/globals.css`.
- Add `next/font` for DM Sans and Newsreader.
- Update shared primitives (`button`, `card`, `input`, `label`, `badge`, `select`, `sonner`) through tokens where possible.
- Remap dark mode deliberately.
- Preserve focus rings, reduced motion, and existing Tailwind v4/shadcn conventions.
- Do not paste `index.css` wholesale; it has two full cascades and non-token global selectors.

**Exit criteria:** all existing screens still render correctly with only visual token changes; typecheck/lint/build pass.

---

## Phase 3 — Landing page

**Effort:** 1–1.5 days  
**Risk:** low, isolated route.

Likely files:

- `src/app/page.tsx`.
- New `src/components/marketing/*` sections.
- `public/*` for owned images/mark.

Adapt Daymark's landing structure:

- announcement bar, sticky nav, hero, value strip, check-in demo, cadence cards, daily thought concept, history/trend card, privacy section, community section, roadmap, CTA, footer.

Rules:

- CTAs point to `/register` and `/login`, not a fake prototype.
- Use `next/link` and `next/image`.
- Replace missing Manus photos.
- Remove false “not live” copy.
- Keep “no leaderboard” and signed-in/moderation-gated discovery language accurate.
- Responsive and accessible before merge.

**Exit criteria:** landing page browser-smoked at desktop and mobile widths; no fake signup/community claims.

---

## Phase 4 — App shell and navigation

**Effort:** 0.75–1 day  
**Risk:** medium; must preserve gating and offline state.

Likely file: `src/components/shell/app-shell.tsx`.

Adopt the Daymark sidebar/topbar/content visual structure, but preserve:

- skip link,
- signed-in user display,
- sign out,
- sync/offline pending count,
- desktop and mobile navigation,
- `/app/discover` visibility only when discovery is configured,
- `/app/moderation` link only for allowlisted moderators.

The Daymark prototype's fixed nine-item nav must not replace our gated nav.

**Exit criteria:** member and moderator nav states verified in browser; offline/sync indicator still works.

---

## Phase 5 — Today and habit check-in

**Effort:** 1–1.5 days  
**Risk:** high if prototype state replaces real logic.

Likely files:

- `src/app/app/today/page.tsx`.
- `src/components/habits/today-habit-card.tsx`.
- Related hooks under `src/lib/hooks/`.

Reskin only:

- opening-thought card,
- progress row,
- habit rows,
- gentle reset copy,
- week dots.

Must preserve:

- account-timezone day boundary,
- schedule/opportunity expansion,
- skips and planned breaks,
- count/timer/note states,
- optimistic write and offline retry queue,
- undo behaviour.

Do not replace real habit state with four booleans.

**Exit criteria:** tap-through smoke of check-in, skip, undo, offline retry, and timezone boundary.

---

## Phase 6 — Core tracking screens

**Effort:** 1.5–2 days  
**Risk:** medium.

Screens:

- `/app` dashboard — stat cards and snapshot-derived charts.
- `/app/grid` — month grid and legend.
- `/app/habits` and `/app/habits/[habitId]` — library rows, filters, cadence cards.
- `/app/analytics` — bars and per-habit performance.

Use real derived data only. Decorative Daymark dots become real grid cells. Keep private-by-default framing.

**Exit criteria:** visual smoke on each route; no invented progress numbers; tests/build pass.

---

## Phase 7 — Trust surfaces and settings

**Effort:** 2–3 days  
**Risk:** highest; these encode our privacy and safety guarantees.

Screens/components:

- `src/app/app/accountability/page.tsx`
- `src/app/app/circles/**`
- `src/components/circles/*`
- weekly review panel
- in-app reminders/settings
- `src/app/app/settings/page.tsx`
- `src/app/app/privacy/page.tsx`
- discovery and moderation panels

Daymark's consent field list and preview layout are the most reusable patterns here, but they must be rebuilt on:

- exact-email invites,
- signed-in acceptance,
- active circle-scoped grants,
- explicit preview before grant,
- revocation,
- block/mute/report,
- anonymous reaction counts,
- private weekly review,
- honest in-app reminders,
- transactional export/restore/delete.

Do not introduce one-click sharing, named reactor attribution, public profiles, rankings, or "not live" labels.

**Exit criteria:** full privacy/circles/discovery/moderation smoke with QA accounts; all invariants re-verified.

---

## Phase 8 — Optional deeper Daymark concepts

**Effort:** 1–3 weeks, separate approval.

Candidates:

- richer starter-set onboarding inspired by the prototype,
- daily opening thought as a real per-user preference,
- expanded reminder editor,
- more expressive card/chart patterns.

These are **not** part of the visual reskin. Each needs its own spec, data model decision, tests, and privacy review.

---

## Verification gate for every phase

1. `corepack pnpm typecheck`
2. `corepack pnpm test`
3. `corepack pnpm lint`
4. `corepack pnpm build`
5. Browser smoke on affected routes at desktop and mobile widths.
6. Re-check the non-negotiables list.
7. Commit with a focused message.
8. Push with `git push origin HEAD:web-app`, then mirror to `main`.

## Status

Phase 0 decisions are approved and Phase 1 is complete: the app is branded Daymark in
copy, metadata, manifest, icon, and export filenames, with no feature or backup-schema
changes.

Phase 2 is complete: paper-light is the default theme (system preference is still
respected), dark mode uses the same ink/lime system, globals carry Daymark color/type/
radius tokens, DM Sans and Newsreader are self-hosted via `next/font`, and shared
primitives use the remapped tokens. Next work item: **Phase 3 — landing page**.
