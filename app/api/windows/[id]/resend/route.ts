import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { resendStageSms } from "@/lib/admin";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  }
  const { id } = await ctx.params;
  await resendStageSms(id);
  return NextResponse.redirect(new URL(`/windows/${id}?resent=1`, request.url), { status: 303 });
}
