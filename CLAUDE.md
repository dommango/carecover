# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

CareCover routes caregiving coverage windows: post a window, family (tier 1) is texted a no-login link to accept all or part of it, and any gaps left at a deadline escalate to paid caregivers (tier 2), each open block all-or-nothing.

## Commands

```bash
npm run dev              # dev server (Turbopack) on :3000
npm run build            # production build
npm run test:run         # all unit + integration tests (one-shot)
npx vitest run lib/__tests__/coverage.test.ts        # single test file
npx vitest run -t "routes a window through"          # single test by name
npm run db:migrate       # create/apply a migration (dev)
npm run db:seed          # seed 2 family + 2 caregivers (only if table empty)
npm run smoke            # HTTP smoke vs a running server (needs build + start)
npm run links            # dev: print logged SMS response links (Twilio off)
npm run test:e2e         # Playwright admin happy path (npx playwright install chromium first)
```

There is no `lint` in build (Next 16 dropped it); run `npx eslint .` and `npx tsc --noEmit` directly.

### Local database

Postgres runs in a docker container on **port 5435** (not 5432, which other projects use):

```bash
docker run -d --name carecover-postgres \
  -e POSTGRES_USER=carecover -e POSTGRES_PASSWORD=carecover -e POSTGRES_DB=carecover \
  -p 5435:5432 postgres:16-alpine
```

**The integration tests reset the database** (`deleteMany` on every table in `beforeEach`/`afterAll`). Never run `npm run test:run` against a database whose data you care about — including a dev session you're actively clicking through. Re-seed with `npm run db:seed` afterward.

## Architecture

Three layers, strictly ordered — understand them in this order:

1. **Pure core — `lib/coverage.ts`.** No I/O; plain functions over `Interval`s. This is where every scheduling rule lives and is the most heavily tested: `computeGaps`, `isFullyCovered`, `eligibleCaregivers`, `canClaim` (tier-1 = any sub-range inside a free gap; tier-2 = must match a whole gap exactly), `escalationPlan` (per gap → text eligible caregivers vs flag to admin). **Coverage gaps are always derived here, never stored.**

2. **Service layer** — `lib/windows.ts` (create window + text family, resolve token → response view, `claimViaToken`, decline), `lib/escalation.ts` (the deadline cron logic), `lib/admin.ts` (dashboard summaries, manual assign, close, resend), `lib/respondents.ts` (respondent CRUD, surfaced at `/respondents`). Claims run inside a `$transaction` at **Serializable isolation** with a retry on `P2034`, giving first-come-wins when two people claim overlapping time. All form input is parsed with the zod schemas in `lib/validation.ts` before reaching this layer.

3. **Next.js App Router** — Server Components read via the service layer; mutations are plain HTML form POSTs to route handlers under `app/api/*` that redirect back (303). Works without client JS, which matters for the no-login `/r/[token]` response page that family/caregivers open from a text.

### Domain flow

`Window` (status `OPEN_TIER1 → ESCALATED_TIER2 → FILLED`, plus `CLOSED`/`EXPIRED`) holds `Assignment`s (covered blocks). At a window's `tier1DeadlineAt`, the external cron (`/api/cron/check-deadlines`, secret-guarded) runs `runDeadlineEscalation` — idempotent, only touches `OPEN_TIER1` windows. Each caregiver has a `minShiftMinutes` (default 240); gaps shorter than a caregiver's minimum are never texted to them — they're flagged to the admin. A `ResponseToken` (random, stored hashed) per `(window, respondent)` is embedded in the SMS link and authorizes the no-login page.

### Cross-cutting invariants — easy to break

- **Times are UTC instants in the DB; entry/display is one zone** (`APP_TIMEZONE`, default `America/New_York`). `lib/time.ts` converts: `zonedWallTimeToUtc` (form input → UTC) and `toLocalInputValue` (UTC → datetime-local). Tier-2 claims require an **exact** gap match, so the `toLocalInputValue` → `zonedWallTimeToUtc` round-trip must be lossless — there's a regression test guarding this in `lib/__tests__/time.test.ts`. Time pickers step in 15-minute increments (`step={900}`).
- **SMS is opt-in.** `lib/sms.ts` only sends if all three `TWILIO_*` vars are set; otherwise it records the message (link and all) to `NotificationLog`. This is why local dev works without Twilio and why `npm run links` can recover response URLs.
- **Auth is single-admin** (`lib/auth.ts`): a correct `ADMIN_PASSWORD` mints an HMAC-signed cookie; there are no user accounts. Respondents are token-only. Route handlers gate with `isAdmin()`; Server Components with `requireAdmin()` from `lib/guard.ts`.
- **Config is validated once at startup** (`lib/env.ts`): all env vars go through a zod schema at import, so misconfiguration throws loudly rather than failing at first request. Import `env`/`smsEnabled` from here — don't read `process.env` directly.
- **Redirect via `appRedirect()` from `lib/http.ts`, not `request.url`.** Behind Railway's proxy, `request.url` is the internal container address; redirects must be built from the trusted public `APP_BASE_URL`. Route handlers use `appRedirect(path)` (303) to send the browser back.

### Stack specifics (see `AGENTS.md`)

Next.js 16 + React 19, Prisma 7, Tailwind v4. `AGENTS.md` warns that this Next.js diverges from training data — consult `node_modules/next/dist/docs/` before writing framework code. Known breaking changes already handled here: `cookies()`/`headers()` and route `params` are **async** (await them); `middleware` is renamed `proxy`. Prisma 7 needs a **driver adapter** — the client is generated to `generated/prisma` (gitignored), the connection URL lives in `prisma.config.ts` (not the schema), and `lib/db.ts` instantiates `PrismaClient` with `PrismaPg`.

## Deploy (Railway)

`railway.json` runs `prisma migrate deploy` before `npm run start`. A **separate** Railway service runs `npm run cron` on a schedule (e.g. `*/5 * * * *`) to ping the deadline checker with `CRON_SECRET`. All env vars are documented in `README.md` / `.env.example`.
