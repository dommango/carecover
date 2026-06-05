import { NextRequest, NextResponse } from "next/server";
import { destroyAdminSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  await destroyAdminSession();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
