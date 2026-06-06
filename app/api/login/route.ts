import { NextRequest } from "next/server";
import { loginSchema } from "@/lib/validation";
import { checkAdminPassword, createAdminSession } from "@/lib/auth";
import { appRedirect } from "@/lib/http";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const parsed = loginSchema.safeParse({ password: form.get("password") });

  if (!parsed.success || !checkAdminPassword(parsed.data.password)) {
    return appRedirect("/login?error=1");
  }

  await createAdminSession();
  return appRedirect("/");
}
