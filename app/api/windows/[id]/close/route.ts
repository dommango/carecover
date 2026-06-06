import { NextRequest } from "next/server";
import { isAdmin } from "@/lib/auth";
import { closeWindow } from "@/lib/admin";
import { appRedirect } from "@/lib/http";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return appRedirect("/login");
  }
  const { id } = await ctx.params;
  await closeWindow(id);
  return appRedirect(`/windows/${id}`);
}
