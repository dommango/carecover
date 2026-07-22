import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { expirePastWindows, runDeadlineEscalation } from "@/lib/escalation";
import { purgeOldNotificationBodies } from "@/lib/retention";

// Called every minute by the Railway cron service with the shared secret. Idempotent.
export async function POST(request: NextRequest) {
  if (request.headers.get("x-cron-secret") !== env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const expired = await expirePastWindows();
  const results = await runDeadlineEscalation();
  const purgedBodies = await purgeOldNotificationBodies();
  return NextResponse.json({ processed: results.length, expired, purgedBodies, results });
}
