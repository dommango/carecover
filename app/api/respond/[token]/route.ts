import { NextRequest, NextResponse } from "next/server";
import { claimSchema } from "@/lib/validation";
import { zonedWallTimeToUtc } from "@/lib/time";
import { claimViaToken, declineViaToken, notifyIfFilled } from "@/lib/windows";

// No-login endpoint: the token in the path authorizes the responder.
export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const form = await request.formData();
  const action = String(form.get("action") ?? "");
  const back = (status: string) => new URL(`/r/${token}?status=${status}`, request.url);

  if (action === "decline") {
    await declineViaToken(token);
    return NextResponse.redirect(back("declined"), { status: 303 });
  }

  const parsed = claimSchema.safeParse({
    startsAtLocal: form.get("startsAtLocal"),
    endsAtLocal: form.get("endsAtLocal"),
  });
  if (!parsed.success) {
    return NextResponse.redirect(back("invalid"), { status: 303 });
  }

  const result = await claimViaToken(token, {
    start: zonedWallTimeToUtc(parsed.data.startsAtLocal),
    end: zonedWallTimeToUtc(parsed.data.endsAtLocal),
  });

  if (result.ok && result.filled) {
    await notifyIfFilled(result.windowId);
  }

  return NextResponse.redirect(back(result.ok ? "claimed" : "conflict"), { status: 303 });
}
