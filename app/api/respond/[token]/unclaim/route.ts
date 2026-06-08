import { NextRequest } from "next/server";
import { unclaimViaToken } from "@/lib/windows";
import { appRedirect } from "@/lib/http";

export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const result = await unclaimViaToken(token);
  if (!result.ok) {
    return appRedirect(`/r/${token}?status=unclaim-error`);
  }
  return appRedirect(`/r/${token}?status=unclaimed`);
}
