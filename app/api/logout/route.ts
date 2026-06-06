import { destroyAdminSession } from "@/lib/auth";
import { appRedirect } from "@/lib/http";

export async function POST() {
  await destroyAdminSession();
  return appRedirect("/login");
}
