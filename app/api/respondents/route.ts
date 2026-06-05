import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { respondentSchema } from "@/lib/validation";
import { createRespondent } from "@/lib/respondents";

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  }

  const form = await request.formData();
  const parsed = respondentSchema.safeParse({
    name: form.get("name"),
    phone: form.get("phone"),
    tier: form.get("tier"),
    minShiftMinutes: form.get("minShiftMinutes") ?? 240,
    active: form.get("active") === "on" || form.get("active") === "true",
  });

  if (!parsed.success) {
    return NextResponse.redirect(new URL("/respondents?error=1", request.url), { status: 303 });
  }

  try {
    await createRespondent(parsed.data);
  } catch {
    return NextResponse.redirect(new URL("/respondents?error=phone", request.url), { status: 303 });
  }

  return NextResponse.redirect(new URL("/respondents", request.url), { status: 303 });
}
