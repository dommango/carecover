import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { closeWindow } from "@/lib/admin";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  }
  const { id } = await ctx.params;
  await closeWindow(id);
  return NextResponse.redirect(new URL(`/windows/${id}`, request.url), { status: 303 });
}
