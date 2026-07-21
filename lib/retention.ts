import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Blank the stored body of SMS NotificationLog rows older than the retention
 * window. Status, timestamps, and provider IDs are kept so the delivery log stays
 * useful for troubleshooting; only the message text (the PII-bearing part) is
 * dropped. Event rows (channel "event") are exempt — they are first-name-only
 * audit entries ("Ann declined") kept as coverage history. Idempotent — runs on
 * each cron tick.
 */
export async function purgeOldNotificationBodies(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - env.LOG_BODY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await prisma.notificationLog.updateMany({
    where: { channel: "sms", sentAt: { lt: cutoff }, body: { not: "" } },
    data: { body: "" },
  });
  return count;
}
