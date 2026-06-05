# CareCover

Coordinate caregiving coverage windows. Post a window, and CareCover texts tier-1
(family) a link to accept all or part of it. If gaps remain at a deadline, it
escalates the open blocks to tier-2 (paid caregivers), each block all-or-nothing.

Next.js (App Router) · PostgreSQL (Prisma 7) · Twilio SMS · deploys on Railway.

## How it works

1. **Post a window** (admin dashboard) — start/end, notes, and a tier-1 deadline.
2. **Sisters get a text** with a no-login link; each can claim any free sub-range or decline.
3. **At the deadline**, a cron job escalates remaining gaps: each open block is texted to
   caregivers whose minimum shift fits it; blocks too short for anyone are flagged to you.
4. **Caregivers** claim a whole block; first to accept wins. Full coverage marks the window filled.

## Local development

```bash
# Postgres (one-time): a docker container on :5435
docker run -d --name carecover-postgres \
  -e POSTGRES_USER=carecover -e POSTGRES_PASSWORD=carecover -e POSTGRES_DB=carecover \
  -p 5435:5432 postgres:16-alpine

cp .env.example .env        # then edit values
npm install                 # runs `prisma generate`
npm run db:migrate          # apply migrations
npm run db:seed             # optional: example respondents
npm run dev
```

Without Twilio credentials, SMS is **not sent** — each message is recorded to the
`NotificationLog` table (the response link is in the body), so the whole flow works locally.

## Testing

```bash
npm run test:run            # unit (coverage logic, time) + integration (full flow vs Postgres)
npm run smoke               # HTTP smoke against a running server (npm run build && npm start)
npm run test:e2e            # Playwright admin happy path (npx playwright install chromium first)
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (Railway provides this) |
| `APP_TIMEZONE` | Entry/display timezone, e.g. `America/New_York` |
| `APP_BASE_URL` | Public URL, used to build SMS links |
| `ADMIN_PASSWORD` | Single-admin login password |
| `SESSION_SECRET` | Signs the admin session cookie (≥16 chars) |
| `TIER1_DEFAULT_DEADLINE_HOURS` | Default sisters' deadline when unset (default 12) |
| `CRON_SECRET` | Shared secret for the deadline cron endpoint |
| `ADMIN_PHONE` | Optional: receives "filled"/escalation alerts |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | Twilio SMS (blank = log instead of send) |

## Deploying on Railway

1. **Web service** — deploy this repo. `railway.json` runs `prisma migrate deploy`
   before start, then `npm run start`. Set all env vars above.
2. **Postgres plugin** — provides `DATABASE_URL`.
3. **Cron service** — a second service from the same repo running `npm run cron`
   on a schedule (e.g. `*/5 * * * *`). It pings `/api/cron/check-deadlines` with
   `CRON_SECRET`. Give it `APP_BASE_URL` and `CRON_SECRET`.
4. **Twilio** — set the three Twilio vars to start sending real texts.
