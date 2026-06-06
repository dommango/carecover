import { NextRequest } from "next/server";
import { claimSchema } from "@/lib/validation";
import { zonedWallTimeToUtc } from "@/lib/time";
import { claimViaToken, declineViaToken, notifyIfFilled } from "@/lib/windows";
import { appRedirect } from "@/lib/http";

// No-login endpoint: the token in the path authorizes the responder.
export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const form = await request.formData();
  const action = String(form.get("action") ?? "");
  const back = (status: string) => appRedirect(`/r/${token}?status=${status}`);

  if (action === "decline") {
    await declineViaToken(token);
    return back("declined");
  }

  const parsed = claimSchema.safeParse({
    startsAtLocal: form.get("startsAtLocal"),
    endsAtLocal: form.get("endsAtLocal"),
  });
  if (!parsed.success) {
    return back("invalid");
  }

  const result = await claimViaToken(token, {
    start: zonedWallTimeToUtc(parsed.data.startsAtLocal),
    end: zonedWallTimeToUtc(parsed.data.endsAtLocal),
  });

  if (result.ok && result.filled) {
    await notifyIfFilled(result.windowId);
  }

  return back(result.ok ? "claimed" : "conflict");
}
