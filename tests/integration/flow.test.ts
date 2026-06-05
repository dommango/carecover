import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createWindow, claimViaToken, getResponseView } from "@/lib/windows";
import { runDeadlineEscalation } from "@/lib/escalation";

// These run against the local dev Postgres (see docker container on :5435).
// Twilio is unconfigured, so every SMS is recorded to NotificationLog with the
// response link in its body — which is exactly how we recover raw tokens here.

async function reset() {
  await prisma.assignment.deleteMany();
  await prisma.responseToken.deleteMany();
  await prisma.notificationLog.deleteMany();
  await prisma.window.deleteMany();
  await prisma.respondent.deleteMany();
}

async function tokensFor(windowId: string): Promise<Map<string, string>> {
  const logs = await prisma.notificationLog.findMany({ where: { windowId, channel: "sms" } });
  const map = new Map<string, string>();
  for (const log of logs) {
    const m = log.body.match(/\/r\/(\S+)$/);
    if (m && log.respondentId) map.set(log.respondentId, m[1]);
  }
  return map;
}

const day = (h: number, m = 0) => new Date(Date.UTC(2026, 6, 15, h, m)); // future date

beforeEach(reset);
afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

describe("end-to-end coverage flow", () => {
  it("routes a window through tier-1 split, escalation, and tier-2 fill", async () => {
    const [sisterA, sisterB] = await Promise.all([
      prisma.respondent.create({ data: { name: "Sister A", phone: "+15550000001", tier: "TIER1" } }),
      prisma.respondent.create({ data: { name: "Sister B", phone: "+15550000002", tier: "TIER1" } }),
    ]);
    const cgShort = await prisma.respondent.create({
      data: { name: "CG Short", phone: "+15550000003", tier: "TIER2", minShiftMinutes: 120 },
    });
    await prisma.respondent.create({
      data: { name: "CG Long", phone: "+15550000004", tier: "TIER2", minShiftMinutes: 240 },
    });

    // Window 9am–5pm; tier-1 deadline already passed so escalation will fire.
    const window = await createWindow({
      startsAt: day(9),
      endsAt: day(17),
      notes: "Dad — lunch + meds",
      tier1DeadlineAt: new Date(Date.now() - 60_000),
    });

    // Both sisters were texted.
    const t1 = await tokensFor(window.id);
    expect(t1.size).toBe(2);

    // Sister A covers 9–1.
    const a = await claimViaToken(t1.get(sisterA.id)!, { start: day(9), end: day(13) });
    expect(a).toMatchObject({ ok: true, filled: false });

    // Sister B tries an overlapping 11–2 — rejected, told what's free.
    const overlap = await claimViaToken(t1.get(sisterB.id)!, { start: day(11), end: day(14) });
    expect(overlap.ok).toBe(false);
    if (!overlap.ok) expect(overlap.freeNow).toEqual([{ start: day(13), end: day(17) }]);

    // Sister B then covers 1–3, leaving a 3–5 (120 min) gap.
    const b = await claimViaToken(t1.get(sisterB.id)!, { start: day(13), end: day(15) });
    expect(b).toMatchObject({ ok: true, filled: false });

    // Deadline escalation: 3–5 is 120 min → only the short-minimum caregiver is eligible.
    const escalation = await runDeadlineEscalation();
    expect(escalation).toHaveLength(1);
    expect(escalation[0]).toMatchObject({ outcome: "escalated", caregiversTexted: 1, flaggedGaps: 0 });

    const refreshed = await prisma.window.findUniqueOrThrow({ where: { id: window.id } });
    expect(refreshed.status).toBe("ESCALATED_TIER2");

    const t2 = await tokensFor(window.id);
    const cgToken = t2.get(cgShort.id)!;
    expect(cgToken).toBeTruthy();

    // Caregiver sees exactly the eligible gap and must take it whole.
    const view = await getResponseView(cgToken);
    expect(view?.tier).toBe("TIER2");
    expect(view?.actionableGaps).toEqual([{ start: day(15), end: day(17) }]);

    const partial = await claimViaToken(cgToken, { start: day(15), end: day(16) });
    expect(partial.ok).toBe(false); // tier-2 cannot take a partial slice

    const whole = await claimViaToken(cgToken, { start: day(15), end: day(17) });
    expect(whole).toMatchObject({ ok: true, filled: true });

    const filled = await prisma.window.findUniqueOrThrow({ where: { id: window.id } });
    expect(filled.status).toBe("FILLED");
  });

  it("flags a sub-minimum gap to the admin instead of texting caregivers", async () => {
    await prisma.respondent.create({
      data: { name: "Sister A", phone: "+15550000001", tier: "TIER1" },
    });
    await prisma.respondent.create({
      data: { name: "CG", phone: "+15550000003", tier: "TIER2", minShiftMinutes: 120 },
    });

    const window = await createWindow({
      startsAt: day(9),
      endsAt: day(17),
      notes: "",
      tier1DeadlineAt: new Date(Date.now() - 60_000),
    });

    const t1 = await tokensFor(window.id);
    const sisterToken = [...t1.values()][0];
    // Cover everything except a 90-minute sliver (11:00–12:30).
    await claimViaToken(sisterToken, { start: day(9), end: day(11) });
    await claimViaToken(sisterToken, { start: day(12, 30), end: day(17) });

    const escalation = await runDeadlineEscalation();
    expect(escalation[0]).toMatchObject({
      outcome: "all_flagged",
      caregiversTexted: 0,
      flaggedGaps: 1,
    });

    const tier2Tokens = await prisma.responseToken.count({ where: { tier: "TIER2" } });
    expect(tier2Tokens).toBe(0); // nobody was eligible, so no caregiver token issued
  });
});
