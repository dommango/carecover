import { NextRequest } from "next/server";
import { isAdmin } from "@/lib/auth";
import { unassign } from "@/lib/admin";
import { appRedirect } from "@/lib/http";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return appRedirect("/login");
  }
  const { id } = await ctx.params;
  const form = await request.formData();
  const assignmentId = String(form.get("assignmentId") ?? "");

  if (!assignmentId) {
    return appRedirect(`/windows/${id}?error=unassign`);
  }

  await unassign(id, assignmentId);
  return appRedirect(`/windows/${id}?ok=unassigned`);
}
