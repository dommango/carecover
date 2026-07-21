import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { hashToken } from "@/lib/tokens";

function toICalUTC(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function icalEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const responseToken = await prisma.responseToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!responseToken || responseToken.revokedAt || responseToken.expiresAt < new Date()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const assignment = await prisma.assignment.findFirst({
    where: {
      windowId: responseToken.windowId,
      respondentId: responseToken.respondentId,
    },
    orderBy: { claimedAt: "desc" },
  });

  if (!assignment) {
    return new NextResponse("Not found", { status: 404 });
  }

  const now = new Date();

  // The event lands in a third-party calendar (Google/Apple), so it carries no
  // names or notes — just the times and a link back to the token page for details.
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CareCover//EN",
    "BEGIN:VEVENT",
    `UID:${assignment.id}@carecover`,
    `DTSTAMP:${toICalUTC(now)}`,
    `DTSTART:${toICalUTC(assignment.startsAt)}`,
    `DTEND:${toICalUTC(assignment.endsAt)}`,
    "SUMMARY:CareCover shift",
    `DESCRIPTION:${icalEscape(`Caregiving coverage — details: ${env.APP_BASE_URL}/r/${token}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  const body = lines.join("\r\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="carecover-shift.ics"',
    },
  });
}
