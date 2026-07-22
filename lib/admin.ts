import { prisma } from "@/lib/db";
import {
  computeGaps,
  isFullyCovered,
  canClaim,
  minutes,
  type ClaimRule,
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
  /** Tier that filled this block; null for an admin manual assignment. */
  tierLabel: string | null;
  tierPosition: number | null;
  startsAt: Date;
  endsAt: Date;
}

export interface TierSummary {
  id: string;
  position: number;
  label: string | null;
  claimRule: ClaimRule;
  minShiftMinutes: number;
  deadlineAt: Date | null;
  memberCount: number;
  /** True for the tier currently (and most recently) opened. */
  active: boolean;
}

export interface WindowSummary {
  id: string;
  status: Window["status"];
  notes: string;
  taskTags: string[];
  startsAt: Date;
  endsAt: Date;
  activeTierIndex: number;
  currentTierDeadlineAt: Date | null;
  tiers: TierSummary[];
  assignments: AssignmentView[];
  gaps: Interval[];
  flaggedGaps: Interval[];
  coveredPercent: number;
}

type WindowWithRelations = {
  id: string;
  status: Window["status"];
  notes: string;
  taskTags: string[];
  startsAt: Date;
  endsAt: Date;
  activeTierIndex: number;
  currentTierDeadlineAt: Date | null;
  tiers: {
    id: string;
    position: number;
    label: string | null;
    claimRule: ClaimRule;
    minShiftMinutes: number;
    deadlineAt: Date | null;
    _count: { members: number };
  }[];
  assignments: {
    id: string;
    startsAt: Date;
    endsAt: Date;
    respondent: { name: string };
    windowTier: { label: string | null; position: number } | null;
  }[];
};

/**
 * Gaps that no configured tier could ever fill: only possible when the ladder has
 * no PARTIAL tier (any of which can take any sub-range) and the gap is shorter than
 * the most permissive WHOLE_GAP tier's minimum.
 */
function computeFlaggedGaps(gaps: Interval[], tiers: WindowWithRelations["tiers"]): Interval[] {
  if (tiers.some((t) => t.claimRule === "PARTIAL")) return [];
  const wholeMins = tiers.filter((t) => t.claimRule === "WHOLE_GAP").map((t) => t.minShiftMinutes);
  if (wholeMins.length === 0) return [];
  const minMin = Math.min(...wholeMins);
  return gaps.filter((g) => minutes(g) < minMin);
}

function summarize(window: WindowWithRelations): WindowSummary {
  const interval = windowInterval(window);
  const covered = coveredIntervals(window.assignments);
  const gaps = computeGaps(interval, covered);
  const total = minutes(interval);
  const remaining = gaps.reduce((sum, g) => sum + minutes(g), 0);
  const coveredPercent = total === 0 ? 100 : Math.round(((total - remaining) / total) * 100);

  return {
    id: window.id,
    status: window.status,
    notes: window.notes,
    taskTags: window.taskTags,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    activeTierIndex: window.activeTierIndex,
    currentTierDeadlineAt: window.currentTierDeadlineAt,
    tiers: window.tiers
      .map((t) => ({
        id: t.id,
        position: t.position,
        label: t.label,
        claimRule: t.claimRule,
        minShiftMinutes: t.minShiftMinutes,
        deadlineAt: t.deadlineAt,
        memberCount: t._count.members,
        active: t.position === window.activeTierIndex && window.status === "OPEN",
      }))
      .sort((a, b) => a.position - b.position),
    assignments: window.assignments
      .map((a) => ({
        id: a.id,
        respondentName: a.respondent.name,
        tierLabel: a.windowTier?.label ?? null,
        tierPosition: a.windowTier?.position ?? null,
        startsAt: a.startsAt,
        endsAt: a.endsAt,
      }))
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    gaps,
    flaggedGaps: computeFlaggedGaps(gaps, window.tiers),
    coveredPercent,
  };
}

const summaryInclude = {
  tiers: { include: { _count: { select: { members: true } } }, orderBy: { position: "asc" as const } },
  assignments: { include: { respondent: true, windowTier: true } },
};

export async function getAdminWindows(): Promise<WindowSummary[]> {
  const windows = await prisma.window.findMany({
    orderBy: { startsAt: "desc" },
    include: summaryInclude,
  });
  return windows.map(summarize);
}

export async function getWindowDetail(id: string): Promise<WindowSummary | null> {
  const window = await prisma.window.findUnique({ where: { id }, include: summaryInclude });
  return window ? summarize(window) : null;
}

export async function closeWindow(id: string): Promise<void> {
  await prisma.window.update({ where: { id }, data: { status: "CLOSED" } });
}

export type ManualAssignResult = { ok: true; filled: boolean } | { ok: false; reason: string };

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
        const check = canClaim(windowInterval(window), covered, range, "PARTIAL");
        if (!check.ok) return { ok: false as const, reason: check.reason };

        await tx.assignment.create({
          data: {
            windowId,
            respondentId,
            windowTierId: null, // admin override is not tied to any tier
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

export async function unassign(windowId: string, assignmentId: string): Promise<{ ok: boolean }> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const assignment = await tx.assignment.findUnique({ where: { id: assignmentId } });
        if (!assignment || assignment.windowId !== windowId) {
          return { ok: false as const };
        }

        await tx.assignment.delete({ where: { id: assignmentId } });

        const window = await tx.window.findUniqueOrThrow({
          where: { id: windowId },
          include: { assignments: true },
        });

        const gaps = computeGaps(windowInterval(window), coveredIntervals(window.assignments));

        if (window.status === "FILLED" && gaps.length > 0) {
          // Re-open at whatever tier the ladder had reached; activeTierIndex is preserved.
          await tx.window.update({ where: { id: windowId }, data: { status: "OPEN" } });
        }

        return { ok: true as const };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch {
    return { ok: false };
  }
}

export type EditWindowResult = { ok: true } | { ok: false; reason: string };

/**
 * Edit a window's times/notes. Only allowed before anyone has claimed. Tier deadlines
 * are recomputed to preserve each tier's lead before the (possibly new) start time;
 * the tier structure and membership themselves are fixed at creation.
 */
export async function editWindow(
  id: string,
  {
    startsAt,
    endsAt,
    notes,
    taskTags,
  }: { startsAt: Date; endsAt: Date; notes: string; taskTags: string[] },
): Promise<EditWindowResult> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const window = await tx.window.findUnique({
          where: { id },
          include: { assignments: true, tiers: { orderBy: { position: "asc" } } },
        });
        if (!window) return { ok: false as const, reason: "Window not found." };
        if (window.assignments.length > 0) {
          return { ok: false as const, reason: "Cannot edit a window that has assignments." };
        }

        const shiftMs = startsAt.getTime() - window.startsAt.getTime();
        for (const tier of window.tiers) {
          if (tier.deadlineAt === null) continue;
          await tx.windowTier.update({
            where: { id: tier.id },
            data: { deadlineAt: new Date(tier.deadlineAt.getTime() + shiftMs) },
          });
        }

        const activeTier = window.tiers.find((t) => t.position === window.activeTierIndex);
        const newCurrentDeadline =
          activeTier?.deadlineAt != null ? new Date(activeTier.deadlineAt.getTime() + shiftMs) : null;

        await tx.window.update({
          where: { id },
          data: { startsAt, endsAt, notes, taskTags, currentTierDeadlineAt: newCurrentDeadline },
        });

        await tx.responseToken.updateMany({ where: { windowId: id }, data: { expiresAt: endsAt } });

        return { ok: true as const };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch {
    return { ok: false, reason: "Could not edit window — please retry." };
  }
}

export async function getWindowNotifications(windowId: string) {
  return prisma.notificationLog.findMany({
    where: { windowId },
    orderBy: { sentAt: "desc" },
    include: { respondent: { select: { name: true } } },
  });
}

/** Re-send response links to the members of the window's currently active tier. */
export async function resendStageSms(windowId: string): Promise<number> {
  const window = await prisma.window.findUniqueOrThrow({
    where: { id: windowId },
    include: {
      assignments: true,
      tiers: { include: { members: { include: { respondent: true } } }, orderBy: { position: "asc" } },
    },
  });
  if (window.status !== "OPEN") return 0;

  const tier = window.tiers.find((t) => t.position === window.activeTierIndex);
  if (!tier) return 0;

  const gaps = computeGaps(windowInterval(window), coveredIntervals(window.assignments));
  const action = tier.claimRule === "PARTIAL" ? "accept all or part" : "accept a shift";

  let sent = 0;
  for (const member of tier.members) {
    if (tier.claimRule === "WHOLE_GAP" && !gaps.some((g) => minutes(g) >= tier.minShiftMinutes)) {
      continue;
    }
    const { token, tokenHash } = generateToken();
    await prisma.responseToken.upsert({
      where: {
        windowId_respondentId_windowTierId: {
          windowId,
          respondentId: member.respondentId,
          windowTierId: tier.id,
        },
      },
      create: {
        windowId,
        respondentId: member.respondentId,
        windowTierId: tier.id,
        tokenHash,
        expiresAt: window.endsAt,
      },
      update: { tokenHash, revokedAt: null, expiresAt: window.endsAt },
    });
    await sendSms({
      to: member.respondent.phone,
      windowId,
      respondentId: member.respondentId,
      body: `CareCover: reminder — coverage needed ${formatRange(window.startsAt, window.endsAt)}. Tap to ${action}: ${responseLink(token)}`,
    });
    sent++;
  }
  return sent;
}
