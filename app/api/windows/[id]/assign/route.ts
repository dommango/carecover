import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { claimSchema } from "@/lib/validation";
import { zonedWallTimeToUtc } from "@/lib/time";
import { manualAssign } from "@/lib/admin";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  }
  const { id } = await ctx.params;
  const form = await request.formData();
  const respondentId = String(form.get("respondentId") ?? "");
  const parsed = claimSchema.safeParse({
    startsAtLocal: form.get("startsAtLocal"),
    endsAtLocal: form.get("endsAtLocal"),
  });

  if (!respondentId || !parsed.success) {
    return NextResponse.redirect(new URL(`/windows/${id}?error=assign`, request.url), { status: 303 });
  }

  const result = await manualAssign(id, respondentId, {
    start: zonedWallTimeToUtc(parsed.data.startsAtLocal),
    end: zonedWallTimeToUtc(parsed.data.endsAtLocal),
  });

  const status = result.ok ? "assigned" : "assign";
  return NextResponse.redirect(new URL(`/windows/${id}?${result.ok ? "ok" : "error"}=${status}`, request.url), {
    status: 303,
  });
}
