import { NextRequest } from "next/server";
import { isAdmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { createWindowSchema } from "@/lib/validation";
import { zonedWallTimeToUtc } from "@/lib/time";
import { createWindow } from "@/lib/windows";
import { appRedirect } from "@/lib/http";

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return appRedirect("/login");
  }

  const form = await request.formData();
  const parsed = createWindowSchema.safeParse({
    startsAtLocal: form.get("startsAtLocal"),
    endsAtLocal: form.get("endsAtLocal"),
    notes: form.get("notes") ?? "",
    tier1DeadlineLocal: form.get("tier1DeadlineLocal") || undefined,
  });

  if (!parsed.success) {
    return appRedirect("/?error=window");
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

  return appRedirect("/");
}
