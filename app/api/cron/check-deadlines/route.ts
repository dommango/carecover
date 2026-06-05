import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runDeadlineEscalation } from "@/lib/escalation";

// Called every minute by the Railway cron service with the shared secret. Idempotent.
export async function POST(request: NextRequest) {
  if (request.headers.get("x-cron-secret") !== env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const results = await runDeadlineEscalation();
  return NextResponse.json({ processed: results.length, results });
}
