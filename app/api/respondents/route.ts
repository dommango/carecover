import { NextRequest } from "next/server";
import { isAdmin } from "@/lib/auth";
import { respondentSchema } from "@/lib/validation";
import { createRespondent } from "@/lib/respondents";
import { appRedirect } from "@/lib/http";

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return appRedirect("/login");
  }

  const form = await request.formData();
  const parsed = respondentSchema.safeParse({
    name: form.get("name"),
    phone: form.get("phone"),
    active: form.get("active") === "on" || form.get("active") === "true",
  });

  if (!parsed.success) {
    return appRedirect("/respondents?error=1");
  }

  try {
    await createRespondent(parsed.data);
  } catch {
    return appRedirect("/respondents?error=phone");
  }

  return appRedirect("/respondents");
}
