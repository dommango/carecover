import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { createWindowSchema } from "@/lib/validation";
import { zonedWallTimeToUtc } from "@/lib/time";
import { createWindow } from "@/lib/windows";

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  }

  const form = await request.formData();
  const parsed = createWindowSchema.safeParse({
    startsAtLocal: form.get("startsAtLocal"),
    endsAtLocal: form.get("endsAtLocal"),
    notes: form.get("notes") ?? "",
    tier1DeadlineLocal: form.get("tier1DeadlineLocal") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.redirect(new URL("/?error=window", request.url), { status: 303 });
  }

  const data = parsed.data;
  const tier1DeadlineAt = data.tier1DeadlineLocal
    ? zonedWallTimeToUtc(data.tier1DeadlineLocal)
    : new Date(Date.now() + env.TIER1_DEFAULT_DEADLINE_HOURS * 3_600_000);

  await createWindow({
    startsAt: zonedWallTimeToUtc(data.startsAtLocal),
    endsAt: zonedWallTimeToUtc(data.endsAtLocal),
    notes: data.notes,
    tier1DeadlineAt,
  });

  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
