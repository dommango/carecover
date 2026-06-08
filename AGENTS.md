<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# CareCover — Agent Guide

CareCover coordinates caregiving coverage windows. An admin posts a window; active family members (tier 1) receive an SMS with a no-login link to claim any sub-range. If gaps remain at the tier-1 deadline, a cron job escalates each open block to paid caregivers (tier 2), who must take a whole gap all-or-nothing. First to accept wins.

## Technology stack

- **Runtime:** Node.js 22.x
- **Framework:** Next.js 16.2.7 (App Router) + React 19.2.4
- **Language:** TypeScript 5 (strict mode)
- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`)
- **Database:** PostgreSQL 16 via Prisma 7.8.0 with the `@prisma/adapter-pg` driver adapter
- **ORM/Client:** Prisma 7; client generated to `generated/prisma` (gitignored)
- **SMS:** Twilio (opt-in; falls back to DB logging when unconfigured)
- **Validation:** Zod 4
- **Testing:** Vitest (unit + integration), Playwright (e2e), custom Node.js smoke script
- **Linting:** ESLint 9 with `eslint-config-next`
- **Deployment:** Railway (web service + separate cron service)

## Build, dev, and test commands

```bash
npm run dev                 # Turbopack dev server on :3000
npm run build               # Production build
npm run start               # Production server

npm run test:run            # All unit + integration tests (one-shot)
npx vitest run lib/__tests__/coverage.test.ts   # single test file
npx vitest run -t "routes a window through"     # single test by name

npm run test:e2e            # Playwright admin happy path
npm run smoke               # HTTP smoke against a running server (needs build + start first)
npm run links               # Print recent response links from NotificationLog (dev helper)

npm run lint                # ESLint (Next 16 dropped lint from build; run manually)
npx tsc --noEmit            # Type check

npm run db:migrate          # Create/apply migrations (dev)
npm run db:deploy           # Apply migrations (production)
npm run db:generate         # Regenerate Prisma client
npm run db:seed             # Seed example respondents (only if table empty)
```

### Local database setup

Postgres is expected on **port 5435** (to avoid colliding with other projects):

```bash
docker run -d --name carecover-postgres \
  -e POSTGRES_USER=carecover -e POSTGRES_PASSWORD=carecover -e POSTGRES_DB=carecover \
  -p 5435:5432 postgres:16-alpine
```

Copy `.env.example` to `.env` and fill values. `npm install` runs `prisma generate` automatically.

## Code organization

### Directory map

```
app/                 # Next.js App Router
  page.tsx           # Admin dashboard (coverage list)
  layout.tsx         # Root layout with fonts + global styles
  login/             # Admin login page (HTML form POST)
  windows/
    new/page.tsx     # Post a window form
    [id]/page.tsx    # Window detail (timeline, manual assign, close, resend)
  respondents/
    page.tsx         # Roster (add/edit tier-1 and tier-2 respondents)
  r/[token]/         # No-login response page (family/caregiver claim UI)
  api/
    login/route.ts
    logout/route.ts
    windows/route.ts
    windows/[id]/
      assign/route.ts
      close/route.ts
      resend/route.ts
    respondents/route.ts
    respondents/[id]/route.ts
    respond/[token]/route.ts
    cron/check-deadlines/route.ts

lib/                 # Business logic, strictly layered
  coverage.ts        # Pure core: interval math, gap computation, claim rules
  windows.ts         # Service layer: create window, issue tokens, claims, declines
  escalation.ts      # Service layer: deadline cron logic
  admin.ts           # Service layer: dashboard summaries, manual assign, close, resend
  respondents.ts     # Service layer: CRUD for respondents
  time.ts            # Timezone conversion, formatting, phone normalization
  tokens.ts          # Secure random tokens + SHA-256 hashing
  auth.ts            # Single-admin password auth + HMAC session cookies
  guard.ts           # Server Component auth redirect helper
  sms.ts             # Twilio send with fallback to NotificationLog
  db.ts              # PrismaClient singleton with driver adapter
  env.ts             # Zod-validated environment schema
  validation.ts      # Zod schemas for forms (windows, respondents, claims, login)
  http.ts            # appRedirect helper (uses APP_BASE_URL)

components/          # React components
  admin-shell.tsx    # Dashboard chrome (sidebar, nav, header)
  ui.tsx             # Design-system primitives (buttons, badges, avatars, notes)
  coverage-bar.tsx   # Proportional timeline bar for coverage visualization
  icons.tsx          # Inline SVG icon set

prisma/
  schema.prisma      # Data model (no datasource url here)
  config.ts          # Prisma config: provides DATABASE_URL
  migrations/        # Prisma migration files
  seed.ts            # Dev seed script

tests/integration/   # Vitest integration tests against Postgres
lib/__tests__/       # Vitest unit tests (pure logic)
e2e/                 # Playwright tests
scripts/
  cron.mjs           # Railway cron entrypoint (pings check-deadlines)
  smoke.mjs          # HTTP smoke test script
  links.mjs          # Dev helper to recover SMS links from DB
```

## Architecture

Three layers, strictly ordered. Understand them in this order:

1. **Pure core — `lib/coverage.ts`.** No I/O; plain functions over `Interval`s. Every scheduling rule lives here and is heavily unit-tested: `computeGaps`, `isFullyCovered`, `eligibleCaregivers`, `canClaim` (tier-1 = any sub-range inside a free gap; tier-2 = must match a whole gap exactly), `escalationPlan`.
   - **Coverage gaps are always derived here, never stored.**

2. **Service layer.** `lib/windows.ts` (create window + text family, token → response view, `claimViaToken`, decline), `lib/escalation.ts` (deadline cron logic), `lib/admin.ts` (dashboard summaries, manual assign, close, resend). Claims run inside a `$transaction` at **Serializable isolation** with a retry on `P2034`, giving first-come-wins when two people claim overlapping time.

3. **Next.js App Router.** Server Components read via the service layer; mutations are plain HTML form POSTs to route handlers under `app/api/*` that redirect back with 303. This works without client JS, which matters for the no-login `/r/[token]` response page that family/caregivers open from a text.

### Domain model

`Window` status lifecycle: `OPEN_TIER1 → ESCALATED_TIER2 → FILLED`, plus `CLOSED`/`EXPIRED`. An `Assignment` is a covered block belonging to a window and a respondent. A `ResponseToken` (random, stored hashed) per `(window, respondent)` is embedded in the SMS link and authorizes the no-login page.

`Respondent` has a `tier` (`TIER1` or `TIER2`) and `minShiftMinutes` (default 240), which is used only for tier-2 eligibility filtering.

`NotificationLog` records every SMS attempt (and failure), which is how local development works without Twilio and how `npm run links` recovers URLs.

## Cross-cutting invariants

### Time handling
Times are **UTC instants in the DB**; entry and display use a single wall-clock zone (`APP_TIMEZONE`, default `America/New_York`). `lib/time.ts` converts:
- `zonedWallTimeToUtc(naiveString, tz)` — form input → UTC Date
- `toLocalInputValue(date, tz)` — UTC Date → `YYYY-MM-DDTHH:mm` for `<input type="datetime-local">`

Tier-2 claims require an **exact** gap match, so the `toLocalInputValue` → `zonedWallTimeToUtc` round-trip must be lossless. There is a regression test in `lib/__tests__/time.test.ts` guarding this. Time pickers use `step={900}` (15-minute increments).

### SMS is opt-in
`lib/sms.ts` only sends real texts if all three `TWILIO_*` variables are set. Otherwise it records the message body (including the response link) to `NotificationLog` with status `SENT`. This is intentional so the full flow works locally without Twilio credentials.

### Auth
Single-admin only (`lib/auth.ts`). A correct `ADMIN_PASSWORD` mints an HMAC-signed cookie (`SESSION_SECRET`). There are no user accounts. Respondents are token-only.

- Route handlers gate with `await isAdmin()`.
- Server Components gate with `await requireAdmin()` from `lib/guard.ts`.

### Prisma 7 specifics
- The client is generated to `generated/prisma` (gitignored).
- The connection URL lives in `prisma.config.ts`, **not** in `schema.prisma`.
- `lib/db.ts` instantiates `PrismaClient` with the `PrismaPg` driver adapter.
- Reuses a global client in development to avoid exhausting connections during hot reload.

### Next.js 16 breaking changes already handled here
- `cookies()` / `headers()` are **async** — always `await` them.
- Route `params` is **async** — always `await ctx.params`.
- `middleware` is renamed `proxy`. This project does not use middleware.

## Testing strategy

### Unit tests (`lib/__tests__/*.test.ts`)
Run against pure logic with no database. The coverage test is the most important: it validates gap computation, claim rules, and escalation planning with mocked intervals.

### Integration tests (`tests/integration/flow.test.ts`)
Run against the **local Postgres on :5435**. They exercise the full flow: create window → tier-1 claim → escalation → tier-2 claim → filled. Twilio is unconfigured, so SMS is captured in `NotificationLog` and tokens are recovered by regex from the logged body.

**The integration tests reset the database** (`deleteMany` on every table in `beforeEach`/`afterAll`). Never run `npm run test:run` against a database whose data you care about — including a dev session you're actively clicking through. Re-seed afterward with `npm run db:seed`.

### E2E tests (`e2e/happy-path.spec.ts`)
Playwright test covering admin login, adding a respondent, and posting a window. Requires the dev `.env`, local Postgres, and `ADMIN_PASSWORD`. The web server is started automatically by Playwright on port 3010 (`APP_BASE_URL=http://localhost:3010`).

### Smoke tests (`scripts/smoke.mjs`)
An HTTP-level script that logs in, creates respondents and a window, recovers a response link from the DB, claims part of the window, and verifies cron authorization. Run against a built and started server (`npm run build && npm run start`).

## Security considerations

- **Tokens:** Response-link tokens are 24 random bytes (base64url). Only SHA-256 hashes are stored; raw tokens exist only in SMS messages and incoming URLs. `tokenMatches` uses `timingSafeEqual`.
- **Sessions:** Admin session cookies are HMAC-signed with `SESSION_SECRET` and use `httpOnly`, `secure` (when `APP_BASE_URL` is HTTPS), and `sameSite: "lax"`. Password comparison is constant-time.
- **Cron endpoint:** `/api/cron/check-deadlines` is protected by the `x-cron-secret` header matching `CRON_SECRET`.
- **Claims:** Concurrent claims on overlapping time are resolved by Serializable database transactions with retry on `P2034` (Prisma write conflict).
- **Phone normalization:** `normalizePhone` enforces E.164. Invalid numbers throw and are handled at the API boundary.
- **Input validation:** All form inputs are validated with Zod before reaching the service layer.

## Environment variables

Required in production; copy `.env.example` to `.env` for local development.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `APP_TIMEZONE` | Wall-clock zone for entry/display (default `America/New_York`) |
| `APP_BASE_URL` | Public URL used to build SMS links (e.g. `https://...`) |
| `ADMIN_PASSWORD` | Single-admin login password |
| `SESSION_SECRET` | HMAC secret for admin session cookie (≥16 chars) |
| `TIER1_DEFAULT_DEADLINE_HOURS` | Default tier-1 deadline when unset per-window (default 12) |
| `CRON_SECRET` | Shared secret for the deadline cron endpoint |
| `ADMIN_PHONE` | Optional E.164 number for fill/escalation alerts |
| `TWILIO_ACCOUNT_SID` | Twilio account (blank = log instead of send) |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_FROM_NUMBER` | Twilio sender E.164 |

## Deployment (Railway)

1. **Web service** — deploy this repo. `railway.json` runs `prisma migrate deploy` before `npm run start`.
2. **Postgres plugin** — provides `DATABASE_URL`.
3. **Cron service** — a second Railway service from the same repo running `npm run cron` on a schedule (e.g. `*/5 * * * *`). It pings `/api/cron/check-deadlines` with `CRON_SECRET`. It needs `APP_BASE_URL` and `CRON_SECRET` only.
4. **Twilio** — set the three Twilio vars to start sending real texts.

## Code style guidelines

- TypeScript strict mode is on. Avoid `any`.
- Prefer plain functions in the service layer; keep React components thin and data-fetching close to the Server Component.
- Mutations are HTML form POSTs that redirect with 303. Do not add client-side fetch wrappers for simple mutations.
- Use `appRedirect` from `lib/http.ts` for all redirects in route handlers; never build redirects from `request.url` because it may be an internal container address behind Railway's proxy.
- Date inputs use `type="datetime-local"` with `step={900}`.
- CSS custom properties (e.g. `var(--accent)`, `var(--sand)`) are defined in `app/globals.css`. Component styles use inline `style` props with CSS custom properties; Tailwind is used sparingly for grid/flex utilities.
