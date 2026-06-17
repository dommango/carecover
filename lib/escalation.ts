import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendSms } from "@/lib/sms";
import { escalationPlan, isFullyCovered } from "@/lib/coverage";
import { formatRange } from "@/lib/time";
import { contactBody, coveredIntervals, issueToken, windowInterval } from "@/lib/windows";

export interface EscalationResult {
  windowId: string;
  outcome: "filled" | "escalated" | "all_flagged";
  /** Tier the window landed on after advancing (the new activeTierIndex). */
  tierIndex: number;
  respondentsTexted: number;
  flaggedGaps: number;
}

/**
 * Advance every OPEN window whose active tier's deadline has passed to the next
 * tier of its ladder, texting that tier's members about the remaining gaps.
 *
 * Catch-up, not one-step: if several deadlines already passed (delayed cron, or a
 * window created after some deadlines), the window lands directly on the correct
 * tier and only that tier is contacted — intermediate tiers whose window already
 * closed are skipped. Idempotent: `currentTierDeadlineAt` is reset to the landed
 * tier's deadline (or null when terminal), so a re-tick won't reprocess a window,
 * and `issueToken` no-ops on links that already exist.
 */
export async function runDeadlineEscalation(now: Date = new Date()): Promise<EscalationResult[]> {
  const due = await prisma.window.findMany({
    where: { status: "OPEN", currentTierDeadlineAt: { lte: now } },
    include: {
      assignments: true,
      tiers: { include: { members: { include: { respondent: true } } }, orderBy: { position: "asc" } },
    },
  });

  const results: EscalationResult[] = [];

  for (const window of due) {
    const interval = windowInterval(window);
    const covered = coveredIntervals(window.assignments);

    if (isFullyCovered(interval, covered)) {
      await prisma.window.update({
        where: { id: window.id },
        data: { status: "FILLED", currentTierDeadlineAt: null },
      });
      results.push({
        windowId: window.id,
        outcome: "filled",
        tierIndex: window.activeTierIndex,
        respondentsTexted: 0,
        flaggedGaps: 0,
      });
      continue;
    }

    const tiers = window.tiers; // ordered by position asc
    const lastIndex = tiers.length - 1;
    // Deadlines are monotonic in position, so the count of passed deadlines is the
    // index of the tier that should now be active (capped at the terminal tier).
    const passed = tiers.filter((t) => t.deadlineAt !== null && t.deadlineAt <= now).length;
    const target = Math.min(passed, lastIndex);
    const tier = tiers[target];

    // PARTIAL tiers have no minimum shift — every gap is text-able (effective min 0).
    const effectiveMin = tier.claimRule === "PARTIAL" ? 0 : tier.minShiftMinutes;
    const plan = escalationPlan(
      interval,
      covered,
      tier.members.map((m) => ({ id: m.respondentId, minShiftMinutes: effectiveMin })),
    );

    const recipientIds = new Set<string>();
    for (const entry of plan.gapsToText) {
      for (const c of entry.caregivers) recipientIds.add(c.id);
    }

    for (const id of recipientIds) {
      const member = tier.members.find((m) => m.respondentId === id);
      if (!member) continue;
      const token = await issueToken(window.id, id, tier.id, window.endsAt);
      if (!token) continue;
      await sendSms({
        to: member.respondent.phone,
        windowId: window.id,
        respondentId: id,
        body: contactBody(window, tier, token),
      });
    }

    await prisma.window.update({
      where: { id: window.id },
      data: { activeTierIndex: target, currentTierDeadlineAt: tier.deadlineAt },
    });

    if (plan.gapsToFlag.length > 0 && env.ADMIN_PHONE) {
      const list = plan.gapsToFlag.map((g) => formatRange(g.start, g.end)).join(", ");
      await sendSms({
        to: env.ADMIN_PHONE,
        windowId: window.id,
        respondentId: null,
        body: `CareCover: ${plan.gapsToFlag.length} gap(s) no one in this tier can take — handle manually: ${list}`,
      });
    }

    results.push({
      windowId: window.id,
      outcome: recipientIds.size > 0 ? "escalated" : "all_flagged",
      tierIndex: target,
      respondentsTexted: recipientIds.size,
      flaggedGaps: plan.gapsToFlag.length,
    });
  }

  return results;
}
