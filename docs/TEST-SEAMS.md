# Test seams

These are the public boundaries this repo tests. Tests observe behaviour at these seams and never reach into implementation details.

| Seam | Public interface | What it specifies |
| --- | --- | --- |
| Calculation seam | `src/domain/calculations.ts` exports | Status cycling, completion/daily/weekly/monthly rates, streaks, monthly snapshot construction, month grid, log de-duplication. |
| Input-validation seam | `src/domain/validation.ts` Zod schemas | Only well-formed months, dates, statuses, categories, colours, and profile patches cross the HTTP boundary. |
| Export seam | `src/domain/csv.ts` | CSV output is deterministic, sorted, and safely quoted. |
| HTTP seam | `/api/workspace/*` route handlers | Every read/write resolves a session, scopes data to that session's user, and returns structured errors. Verified by `pnpm typecheck`, `pnpm build`, and manual browser walkthrough. |
| Circle support seam | `src/domain/circles.ts` exports | Only active members can react, comment, or join a private challenge; content deletion stays with the author or a manager; block/mute boundaries hide interactions in both directions. |
| Moderation gate seam | `src/domain/moderation.ts` exports | Moderator allowlist parsing, public-discovery configuration, forward-only report/challenge status transitions, and active-only joins. Verified by `pnpm test`. |
| Public discovery seam | `/api/workspace/discovery/*` and `/api/workspace/moderation/*` | Signed-in discovery exposes only title/summary/dates/aggregate count; proposals stay hidden until an allowlisted moderator approves; only moderators can change report/challenge status. Verified by `pnpm typecheck`, `pnpm build`, and manual browser walkthrough. |
| Optimistic-write seam | React Query cache + local pending queue | A cell tap updates the UI immediately, queues the write on failure, clears pending writes after a successful flush, and never survives sign-out. Verified in the browser. |

Deliberately not tested at the DOM implementation level: individual Tailwind class strings and third-party Radix/shadcn internals.
