import { NextRequest } from "next/server";
import { isAdmin } from "@/lib/auth";
import { editWindow } from "@/lib/admin";
import { zonedWallTimeToUtc } from "@/lib/time";
import { appRedirect } from "@/lib/http";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return appRedirect("/login");
  }
  const { id } = await ctx.params;
  const form = await request.formData();

  const startsAtLocal = String(form.get("startsAtLocal") ?? "");
  const endsAtLocal = String(form.get("endsAtLocal") ?? "");
  const notes = String(form.get("notes") ?? "");

  if (!startsAtLocal || !endsAtLocal) {
    return appRedirect(`/windows/${id}?error=edit`);
  }

  const result = await editWindow(id, {
    startsAt: zonedWallTimeToUtc(startsAtLocal),
    endsAt: zonedWallTimeToUtc(endsAtLocal),
    notes,
  });

  return appRedirect(`/windows/${id}?${result.ok ? "ok=edited" : "error=edit"}`);
}
