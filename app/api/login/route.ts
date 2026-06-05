import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/lib/validation";
import { checkAdminPassword, createAdminSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const parsed = loginSchema.safeParse({ password: form.get("password") });

  if (!parsed.success || !checkAdminPassword(parsed.data.password)) {
    return NextResponse.redirect(new URL("/login?error=1", request.url), { status: 303 });
  }

  await createAdminSession();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
