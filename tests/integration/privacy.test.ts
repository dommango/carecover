import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createWindow, claimViaToken, unclaimViaToken, declineViaToken } from "@/lib/windows";
import { purgeOldNotificationBodies } from "@/lib/retention";
import { GET as calendarGET } from "@/app/api/respond/[token]/calendar/route";

// Guards the privacy invariants (see CLAUDE.md): SMS bodies never carry notes
// or full names, the .ics export is scrubbed, and logged bodies are purged.

async function reset() {
  await prisma.assignment.deleteMany();
  await prisma.responseToken.deleteMany();
  await prisma.windowTierMember.deleteMany();
  await prisma.windowTier.deleteMany();
  await prisma.notificationLog.deleteMany();
  await prisma.window.deleteMany();
  await prisma.respondent.deleteMany();
}

const ANCHOR = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const day = (h: number, m = 0) =>
  new Date(Date.UTC(ANCHOR.getUTCFullYear(), ANCHOR.getUTCMonth(), ANCHOR.getUTCDate(), h, m));

const NOTES = "Dad — lunch + meds, no driving";

async function makeWindow(respondentId: string) {
  return createWindow({
    startsAt: day(9),
    endsAt: day(17),
    notes: NOTES,
    taskTags: ["MEALS", "TRANSPORT"],
    tiers: [{ claimRule: "PARTIAL", minShiftMinutes: 240, respondentIds: [respondentId] }],
  });
}

async function rawTokenFor(windowId: string): Promise<string> {
  const log = await prisma.notificationLog.findFirstOrThrow({
    where: { windowId, channel: "sms" },
  });
  return log.body.match(/\/r\/(\S+)$/)![1];
}

beforeEach(reset);
afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

describe("privacy invariants", () => {
  it("keeps notes and task details out of every SMS body", async () => {
    const sister = await prisma.respondent.create({
      data: { name: "Sister Ann", phone: "+15550000001" },
    });
    const window = await makeWindow(sister.id);

    const smsLogs = await prisma.notificationLog.findMany({
      where: { windowId: window.id, channel: "sms" },
    });
    expect(smsLogs.length).toBeGreaterThan(0);
    for (const log of smsLogs) {
      expect(log.body).not.toContain("lunch");
      expect(log.body).not.toContain("meds");
      expect(log.body).not.toContain("MEALS");
      expect(log.body).toMatch(/\/r\/\S+$/);
    }
  });

  it("records cancel/decline events with first names only", async () => {
    const sister = await prisma.respondent.create({
      data: { name: "Sister Ann", phone: "+15550000001" },
    });
    const window = await makeWindow(sister.id);
    const token = await rawTokenFor(window.id);

    const claim = await claimViaToken(token, { start: day(9), end: day(13) });
    expect(claim.ok).toBe(true);
    expect(await unclaimViaToken(token)).toMatchObject({ ok: true });
    expect(await declineViaToken(token)).toMatchObject({ ok: true });

    const events = await prisma.notificationLog.findMany({
      where: { windowId: window.id, channel: "event" },
    });
    expect(events.length).toBe(2);
    for (const event of events) {
      expect(event.body).toContain("Sister");
      expect(event.body).not.toContain("Sister Ann");
    }
  });

  it("exports an .ics with no names and no notes, linking back for details", async () => {
    const sister = await prisma.respondent.create({
      data: { name: "Sister Ann", phone: "+15550000001" },
    });
    const window = await makeWindow(sister.id);
    const token = await rawTokenFor(window.id);
    expect((await claimViaToken(token, { start: day(9), end: day(13) })).ok).toBe(true);

    const res = await calendarGET(
      new NextRequest("http://localhost:3000/api/respond/x/calendar"),
      { params: Promise.resolve({ token }) },
    );
    expect(res.status).toBe(200);
    const ics = await res.text();
    expect(ics).toContain("SUMMARY:CareCover shift");
    expect(ics).toContain("/r/");
    expect(ics).not.toContain("Sister");
    expect(ics).not.toContain("lunch");
  });

  it("blanks logged SMS bodies past the retention window, keeping newer ones", async () => {
    const now = new Date();
    const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
    const old = await prisma.notificationLog.create({
      data: { channel: "sms", body: "old body with a link", status: "SENT", sentAt: daysAgo(91) },
    });
    const recent = await prisma.notificationLog.create({
      data: { channel: "sms", body: "recent body", status: "SENT", sentAt: daysAgo(89) },
    });
    const oldEvent = await prisma.notificationLog.create({
      data: { channel: "event", body: "Ann declined", status: "SENT", sentAt: daysAgo(200) },
    });

    expect(await purgeOldNotificationBodies(now)).toBe(1);
    expect((await prisma.notificationLog.findUniqueOrThrow({ where: { id: old.id } })).body).toBe("");
    expect((await prisma.notificationLog.findUniqueOrThrow({ where: { id: recent.id } })).body).toBe(
      "recent body",
    );
    // Event rows are the first-name-only audit trail — never blanked.
    expect(
      (await prisma.notificationLog.findUniqueOrThrow({ where: { id: oldEvent.id } })).body,
    ).toBe("Ann declined");

    // Idempotent: a second run finds nothing left to blank.
    expect(await purgeOldNotificationBodies(now)).toBe(0);
  });
});
