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
  await prisma.windowTierMember.deleteMany();
  await prisma.windowTier.deleteMany();
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
  it("routes a window through a PARTIAL tier split, escalation, and whole-gap fill", async () => {
    const [sisterA, sisterB] = await Promise.all([
      prisma.respondent.create({ data: { name: "Sister A", phone: "+15550000001" } }),
      prisma.respondent.create({ data: { name: "Sister B", phone: "+15550000002" } }),
    ]);
    const cgShort = await prisma.respondent.create({
      data: { name: "CG Short", phone: "+15550000003" },
    });
    const cgLong = await prisma.respondent.create({
      data: { name: "CG Long", phone: "+15550000004" },
    });

    // Window 9am–5pm. Tier deadlines: tier0 (family) at 7am, tier1 (short caregiver)
    // at 8am, tier2 (long caregiver) terminal. Lead hours strictly decrease.
    const window = await createWindow({
      startsAt: day(9),
      endsAt: day(17),
      notes: "Dad — lunch + meds",
      tiers: [
        { label: "Family", claimRule: "PARTIAL", minShiftMinutes: 240, leadHours: 2, respondentIds: [sisterA.id, sisterB.id] },
        { label: "On-call", claimRule: "WHOLE_GAP", minShiftMinutes: 120, leadHours: 1, respondentIds: [cgShort.id] },
        { label: "Agency", claimRule: "WHOLE_GAP", minShiftMinutes: 240, respondentIds: [cgLong.id] },
      ],
    });

    // Both family members (tier 0) were texted.
    const t1 = await tokensFor(window.id);
    expect(t1.size).toBe(2);

    // Sister A covers 9–1 (a PARTIAL sub-range).
    const a = await claimViaToken(t1.get(sisterA.id)!, { start: day(9), end: day(13) });
    expect(a).toMatchObject({ ok: true, filled: false });

    // Sister B tries an overlapping 11–2 — rejected, told what's free.
    const overlap = await claimViaToken(t1.get(sisterB.id)!, { start: day(11), end: day(14) });
    expect(overlap.ok).toBe(false);
    if (!overlap.ok) expect(overlap.freeNow).toEqual([{ start: day(13), end: day(17) }]);

    // Sister B then covers 1–3, leaving a 3–5 (120 min) gap.
    const b = await claimViaToken(t1.get(sisterB.id)!, { start: day(13), end: day(15) });
    expect(b).toMatchObject({ ok: true, filled: false });

    // Escalate at 7:30am — past tier 0's deadline (7am) but before tier 1's (8am),
    // so the window lands on tier 1 (the 120-min-minimum caregiver).
    const escalation = await runDeadlineEscalation(day(7, 30));
    expect(escalation).toHaveLength(1);
    expect(escalation[0]).toMatchObject({
      outcome: "escalated",
      tierIndex: 1,
      respondentsTexted: 1,
      flaggedGaps: 0,
    });

    const refreshed = await prisma.window.findUniqueOrThrow({ where: { id: window.id } });
    expect(refreshed.status).toBe("OPEN");
    expect(refreshed.activeTierIndex).toBe(1);

    const t2 = await tokensFor(window.id);
    const cgToken = t2.get(cgShort.id)!;
    expect(cgToken).toBeTruthy();

    // Caregiver sees exactly the eligible gap and must take it whole.
    const view = await getResponseView(cgToken);
    expect(view?.claimRule).toBe("WHOLE_GAP");
    expect(view?.actionableGaps).toEqual([{ start: day(15), end: day(17) }]);

    const partial = await claimViaToken(cgToken, { start: day(15), end: day(16) });
    expect(partial.ok).toBe(false); // WHOLE_GAP cannot take a partial slice

    const whole = await claimViaToken(cgToken, { start: day(15), end: day(17) });
    expect(whole).toMatchObject({ ok: true, filled: true });

    const filled = await prisma.window.findUniqueOrThrow({ where: { id: window.id } });
    expect(filled.status).toBe("FILLED");
  });

  it("flags a sub-minimum gap when no one in the landed tier can take it", async () => {
    const sister = await prisma.respondent.create({
      data: { name: "Sister A", phone: "+15550000001" },
    });
    const cg = await prisma.respondent.create({ data: { name: "CG", phone: "+15550000003" } });

    const window = await createWindow({
      startsAt: day(9),
      endsAt: day(17),
      notes: "",
      tiers: [
        { label: "Family", claimRule: "PARTIAL", minShiftMinutes: 240, leadHours: 2, respondentIds: [sister.id] },
        { label: "Caregiver", claimRule: "WHOLE_GAP", minShiftMinutes: 120, respondentIds: [cg.id] },
      ],
    });

    const t1 = await tokensFor(window.id);
    const sisterToken = [...t1.values()][0];
    // Cover everything except a 90-minute sliver (11:00–12:30).
    await claimViaToken(sisterToken, { start: day(9), end: day(11) });
    await claimViaToken(sisterToken, { start: day(12, 30), end: day(17) });

    // Escalate to the WHOLE_GAP tier (min 120). The 90-min gap is too short → flagged.
    const escalation = await runDeadlineEscalation(day(7, 30));
    expect(escalation[0]).toMatchObject({
      outcome: "all_flagged",
      tierIndex: 1,
      respondentsTexted: 0,
      flaggedGaps: 1,
    });

    const cgTier = await prisma.windowTier.findFirstOrThrow({
      where: { windowId: window.id, position: 1 },
    });
    const issued = await prisma.responseToken.count({ where: { windowTierId: cgTier.id } });
    expect(issued).toBe(0); // nobody eligible, so no token issued for that tier
  });

  it("cascades down three tiers, contacting only the landed tier each step", async () => {
    const sister = await prisma.respondent.create({ data: { name: "Sister", phone: "+15550000001" } });
    const cgShort = await prisma.respondent.create({ data: { name: "Short", phone: "+15550000003" } });
    const cgLong = await prisma.respondent.create({ data: { name: "Long", phone: "+15550000004" } });

    // Nothing claimed — the whole 9–17 window (480 min) stays open and cascades.
    const window = await createWindow({
      startsAt: day(9),
      endsAt: day(17),
      notes: "",
      tiers: [
        { label: "Family", claimRule: "PARTIAL", minShiftMinutes: 240, leadHours: 3, respondentIds: [sister.id] },
        { label: "On-call", claimRule: "WHOLE_GAP", minShiftMinutes: 120, leadHours: 2, respondentIds: [cgShort.id] },
        { label: "Agency", claimRule: "WHOLE_GAP", minShiftMinutes: 240, respondentIds: [cgLong.id] },
      ],
    });

    // Step 1: past tier 0 (deadline 6am), before tier 1 (7am) → land on tier 1.
    const step1 = await runDeadlineEscalation(day(6, 30));
    expect(step1[0]).toMatchObject({ tierIndex: 1, respondentsTexted: 1 });
    expect((await tokensFor(window.id)).get(cgShort.id)).toBeTruthy();

    // Step 2: past tier 1 (deadline 7am) → land on tier 2.
    const step2 = await runDeadlineEscalation(day(7, 30));
    expect(step2[0]).toMatchObject({ tierIndex: 2, respondentsTexted: 1 });
    expect((await tokensFor(window.id)).get(cgLong.id)).toBeTruthy();

    const atTier2 = await prisma.window.findUniqueOrThrow({ where: { id: window.id } });
    expect(atTier2.activeTierIndex).toBe(2);
    expect(atTier2.currentTierDeadlineAt).toBeNull(); // terminal tier — no further escalation

    // Earlier PARTIAL tier stays claimable after the ladder advanced.
    const sisterToken = (await tokensFor(window.id)).get(sister.id)!;
    const lateClaim = await claimViaToken(sisterToken, { start: day(9), end: day(12) });
    expect(lateClaim.ok).toBe(true);

    // No more escalation: the terminal window is not reprocessed.
    const again = await runDeadlineEscalation(day(9));
    expect(again).toHaveLength(0);
  });

  it("catches up directly to the correct tier when multiple deadlines have passed", async () => {
    const sister = await prisma.respondent.create({ data: { name: "Sister", phone: "+15550000001" } });
    const cgShort = await prisma.respondent.create({ data: { name: "Short", phone: "+15550000003" } });
    const cgLong = await prisma.respondent.create({ data: { name: "Long", phone: "+15550000004" } });

    await createWindow({
      startsAt: day(9),
      endsAt: day(17),
      notes: "",
      tiers: [
        { label: "Family", claimRule: "PARTIAL", minShiftMinutes: 240, leadHours: 3, respondentIds: [sister.id] },
        { label: "On-call", claimRule: "WHOLE_GAP", minShiftMinutes: 120, leadHours: 2, respondentIds: [cgShort.id] },
        { label: "Agency", claimRule: "WHOLE_GAP", minShiftMinutes: 240, respondentIds: [cgLong.id] },
      ],
    });

    // One run at 8am — both tier 0 (6am) and tier 1 (7am) deadlines already passed.
    const result = await runDeadlineEscalation(day(8));
    expect(result[0]).toMatchObject({ tierIndex: 2, respondentsTexted: 1 });

    // Landed straight on tier 2: only the long caregiver was contacted; tier 1 was skipped.
    const issuedToShort = await prisma.responseToken.count({ where: { respondentId: cgShort.id } });
    expect(issuedToShort).toBe(0);
    const issuedToLong = await prisma.responseToken.count({ where: { respondentId: cgLong.id } });
    expect(issuedToLong).toBe(1);
  });
});
