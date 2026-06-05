import { prisma } from "@/lib/db";
import {
  computeGaps,
  escalationPlan,
  isFullyCovered,
  canClaim,
  minutes,
  type Interval,
} from "@/lib/coverage";
import { Prisma, type Window } from "@/generated/prisma/client";
import { generateToken } from "@/lib/tokens";
import { sendSms } from "@/lib/sms";
import { coveredIntervals, responseLink, windowInterval } from "@/lib/windows";
import { formatRange } from "@/lib/time";

export interface AssignmentView {
  id: string;
  respondentName: string;
  tier: "TIER1" | "TIER2";
  startsAt: Date;
  endsAt: Date;
}

export interface WindowSummary {
  id: string;
  status: Window["status"];
  notes: string;
  startsAt: Date;
  endsAt: Date;
  tier1DeadlineAt: Date;
  assignments: AssignmentView[];
  gaps: Interval[];
  flaggedGaps: Interval[];
  coveredPercent: number;
}

function summarize(
  window: {
    id: string;
    status: Window["status"];
    notes: string;
    startsAt: Date;
    endsAt: Date;
    tier1DeadlineAt: Date;
    assignments: { id: string; tier: "TIER1" | "TIER2"; startsAt: Date; endsAt: Date; respondent: { name: string } }[];
  },
  caregivers: { id: string; minShiftMinutes: number }[],
): WindowSummary {
  const interval = windowInterval(window);
  const covered = coveredIntervals(window.assignments);
  const gaps = computeGaps(interval, covered);
  const total = minutes(interval);
  const remaining = gaps.reduce((sum, g) => sum + minutes(g), 0);
  const coveredPercent = total === 0 ? 100 : Math.round(((total - remaining) / total) * 100);
  const flaggedGaps = escalationPlan(interval, covered, caregivers).gapsToFlag;

  return {
    id: window.id,
    status: window.status,
    notes: window.notes,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    tier1DeadlineAt: window.tier1DeadlineAt,
    assignments: window.assignments
      .map((a) => ({
        id: a.id,
        respondentName: a.respondent.name,
        tier: a.tier,
        startsAt: a.startsAt,
        endsAt: a.endsAt,
      }))
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    gaps,
    flaggedGaps,
    coveredPercent,
  };
}

export async function getAdminWindows(): Promise<WindowSummary[]> {
  const [windows, caregivers] = await Promise.all([
    prisma.window.findMany({
      orderBy: { startsAt: "desc" },
      include: { assignments: { include: { respondent: true } } },
    }),
    prisma.respondent.findMany({ where: { tier: "TIER2", active: true } }),
  ]);
  return windows.map((w) => summarize(w, caregivers));
}

export async function getWindowDetail(id: string): Promise<WindowSummary | null> {
  const [window, caregivers] = await Promise.all([
    prisma.window.findUnique({
      where: { id },
      include: { assignments: { include: { respondent: true } } },
    }),
    prisma.respondent.findMany({ where: { tier: "TIER2", active: true } }),
  ]);
  return window ? summarize(window, caregivers) : null;
}

export async function closeWindow(id: string): Promise<void> {
  await prisma.window.update({ where: { id }, data: { status: "CLOSED" } });
}

export type ManualAssignResult =
  | { ok: true; filled: boolean }
  | { ok: false; reason: string };

/** Admin override: assign a respondent to any free sub-range, bypassing tier rules. */
export async function manualAssign(
  windowId: string,
  respondentId: string,
  range: Interval,
): Promise<ManualAssignResult> {
  const respondent = await prisma.respondent.findUnique({ where: { id: respondentId } });
  if (!respondent) return { ok: false, reason: "Respondent not found." };

  try {
    return await prisma.$transaction(
      async (tx) => {
        const window = await tx.window.findUniqueOrThrow({
          where: { id: windowId },
          include: { assignments: true },
        });
        const covered = coveredIntervals(window.assignments);
        const check = canClaim(windowInterval(window), covered, range, "TIER1");
        if (!check.ok) return { ok: false as const, reason: check.reason };

        await tx.assignment.create({
          data: {
            windowId,
            respondentId,
            tier: respondent.tier,
            startsAt: range.start,
            endsAt: range.end,
          },
        });
        const filled = isFullyCovered(windowInterval(window), [...covered, range]);
        if (filled) await tx.window.update({ where: { id: windowId }, data: { status: "FILLED" } });
        return { ok: true as const, filled };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch {
    return { ok: false, reason: "Could not assign — please retry." };
  }
}

/** Rotate and re-send response links to the respondents relevant to the window's stage. */
export async function resendStageSms(windowId: string): Promise<number> {
  const window = await prisma.window.findUniqueOrThrow({
    where: { id: windowId },
    include: { assignments: true },
  });
  if (window.status !== "OPEN_TIER1" && window.status !== "ESCALATED_TIER2") return 0;

  const tier = window.status === "OPEN_TIER1" ? "TIER1" : "TIER2";
  const recipients = await prisma.respondent.findMany({ where: { tier, active: true } });
  const gaps = computeGaps(windowInterval(window), coveredIntervals(window.assignments));

  let sent = 0;
  for (const r of recipients) {
    if (tier === "TIER2" && !gaps.some((g) => minutes(g) >= r.minShiftMinutes)) continue;
    const { token, tokenHash } = generateToken();
    await prisma.responseToken.upsert({
      where: { windowId_respondentId: { windowId, respondentId: r.id } },
      create: { windowId, respondentId: r.id, tier, tokenHash, expiresAt: window.endsAt },
      update: { tokenHash, revokedAt: null, expiresAt: window.endsAt },
    });
    await sendSms({
      to: r.phone,
      windowId,
      respondentId: r.id,
      body: `CareCover: reminder — coverage needed ${formatRange(window.startsAt, window.endsAt)}. Tap: ${responseLink(token)}`,
    });
    sent++;
  }
  return sent;
}
