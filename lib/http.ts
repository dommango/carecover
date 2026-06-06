import { NextResponse } from "next/server";
import { env } from "@/lib/env";

/**
 * Redirect to an app path using the configured public base URL.
 *
 * Behind a reverse proxy (e.g. Railway), the incoming `request.url` is the
 * internal container address (such as https://localhost:8080), so building a
 * redirect from it sends the browser to an unreachable URL. APP_BASE_URL is
 * the trusted public origin and is correct in every environment.
 */
export function appRedirect(path: string): NextResponse {
  return NextResponse.redirect(new URL(path, env.APP_BASE_URL), { status: 303 });
}
