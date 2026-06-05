import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendSms } from "@/lib/sms";
import { escalationPlan, isFullyCovered } from "@/lib/coverage";
import { formatRange } from "@/lib/time";
import { coveredIntervals, issueToken, responseLink, windowInterval } from "@/lib/windows";

export interface EscalationResult {
  windowId: string;
  outcome: "filled" | "escalated" | "all_flagged";
  caregiversTexted: number;
  flaggedGaps: number;
}

/**
 * Process tier-1 windows whose deadline has passed. Idempotent: only OPEN_TIER1
 * windows are touched, so repeated cron ticks are safe. For each window with
 * remaining gaps, texts caregivers eligible for each gap and alerts the admin
 * about gaps too short for anyone.
 */
export async function runDeadlineEscalation(now: Date = new Date()): Promise<EscalationResult[]> {
  const due = await prisma.window.findMany({
    where: { status: "OPEN_TIER1", tier1DeadlineAt: { lte: now } },
    include: { assignments: true },
  });

  const results: EscalationResult[] = [];

  for (const window of due) {
    const interval = windowInterval(window);
    const covered = coveredIntervals(window.assignments);

    if (isFullyCovered(interval, covered)) {
      await prisma.window.update({ where: { id: window.id }, data: { status: "FILLED" } });
      results.push({ windowId: window.id, outcome: "filled", caregiversTexted: 0, flaggedGaps: 0 });
      continue;
    }

    const caregivers = await prisma.respondent.findMany({
      where: { tier: "TIER2", active: true },
    });
    const plan = escalationPlan(
      interval,
      covered,
      caregivers.map((c) => ({ id: c.id, minShiftMinutes: c.minShiftMinutes })),
    );

    await prisma.window.update({ where: { id: window.id }, data: { status: "ESCALATED_TIER2" } });

    const caregiverIds = new Set<string>();
    for (const entry of plan.gapsToText) {
      for (const c of entry.caregivers) caregiverIds.add(c.id);
    }

    for (const id of caregiverIds) {
      const caregiver = caregivers.find((c) => c.id === id);
      if (!caregiver) continue;
      const token = await issueToken(window.id, caregiver.id, "TIER2", window.endsAt);
      if (!token) continue;
      await sendSms({
        to: caregiver.phone,
        windowId: window.id,
        respondentId: caregiver.id,
        body:
          `CareCover: paid coverage needed ${formatRange(window.startsAt, window.endsAt)}` +
          `${window.notes ? ` (${window.notes})` : ""}. ` +
          `Tap to claim a full open block: ${responseLink(token)}`,
      });
    }

    if (plan.gapsToFlag.length > 0 && env.ADMIN_PHONE) {
      const list = plan.gapsToFlag.map((g) => formatRange(g.start, g.end)).join(", ");
      await sendSms({
        to: env.ADMIN_PHONE,
        windowId: window.id,
        respondentId: null,
        body: `CareCover: ${plan.gapsToFlag.length} gap(s) too short for any caregiver — handle manually: ${list}`,
      });
    }

    results.push({
      windowId: window.id,
      outcome: caregiverIds.size > 0 ? "escalated" : "all_flagged",
      caregiversTexted: caregiverIds.size,
      flaggedGaps: plan.gapsToFlag.length,
    });
  }

  return results;
}
