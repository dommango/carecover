import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";

/** For admin Server Components: bounce to the login page unless authenticated. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/login");
}
