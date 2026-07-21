import { z } from "zod";

// Server-only configuration, validated once at import. Throwing here surfaces
// misconfiguration loudly at startup rather than at the first request.
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_TIMEZONE: z.string().default("America/New_York"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  ADMIN_PASSWORD: z.string().min(1),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 chars"),
  TIER1_DEFAULT_DEADLINE_HOURS: z.coerce.number().int().positive().default(12),
  CRON_SECRET: z.string().min(1),
  // SMS bodies in NotificationLog are blanked after this many days (lib/retention.ts).
  LOG_BODY_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
  ADMIN_PHONE: z.string().default(""), // optional: where fill/escalation alerts go
  TWILIO_ACCOUNT_SID: z.string().default(""),
  TWILIO_AUTH_TOKEN: z.string().default(""),
  TWILIO_FROM_NUMBER: z.string().default(""),
});

export const env = schema.parse(process.env);

// When Twilio isn't configured (e.g. local dev), SMS is recorded to the
// NotificationLog instead of sent, so flows can be exercised end-to-end safely.
export const smsEnabled = Boolean(
  env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER,
);
