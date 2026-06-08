import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { generateToken, hashToken } from "@/lib/tokens";
import { sendSms } from "@/lib/sms";
import { computeGaps, isFullyCovered, canClaim, minutes, type Interval } from "@/lib/coverage";
import { formatRange } from "@/lib/time";
import { Prisma, type Tier, type Window } from "@/generated/prisma/client";

export const responseLink = (token: string) => `${env.APP_BASE_URL}/r/${token}`;

export const windowInterval = (w: { startsAt: Date; endsAt: Date }): Interval => ({
  start: w.startsAt,
  end: w.endsAt,
});

export const coveredIntervals = (assignments: { startsAt: Date; endsAt: Date }[]): Interval[] =>
  assignments.map((a) => ({ start: a.startsAt, end: a.endsAt }));

async function notifyAdmin(body: string, windowId: string): Promise<void> {
  if (env.ADMIN_PHONE) {
    await sendSms({ to: env.ADMIN_PHONE, body, windowId, respondentId: null });
  }
}

/** Mint a per-respondent response token (idempotent on the windowId+respondentId pair). */
export async function issueToken(windowId: string, respondentId: string, tier: Tier, expiresAt: Date) {
  const existing = await prisma.responseToken.findUnique({
    where: { windowId_respondentId: { windowId, respondentId } },
  });
  if (existing) return null; // already has a link; don't rotate it out from under them
  const { token, tokenHash } = generateToken();
  await prisma.responseToken.create({
    data: { windowId, respondentId, tier, tokenHash, expiresAt },
  });
  return token;
}

export interface CreateWindowArgs {
  startsAt: Date;
  endsAt: Date;
  notes: string;
  tier1DeadlineAt: Date;
}

/** Create a window and text every active tier-1 sister a response link. */
export async function createWindow(args: CreateWindowArgs): Promise<Window> {
  const window = await prisma.window.create({
    data: {
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      notes: args.notes,
      tier1DeadlineAt: args.tier1DeadlineAt,
    },
  });

  const sisters = await prisma.respondent.findMany({
    where: { tier: "TIER1", active: true },
  });

  for (const sister of sisters) {
    const token = await issueToken(window.id, sister.id, "TIER1", window.endsAt);
    if (!token) continue;
    await sendSms({
      to: sister.phone,
      windowId: window.id,
      respondentId: sister.id,
      body:
        `CareCover: coverage needed ${formatRange(window.startsAt, window.endsAt)}` +
        `${window.notes ? ` (${window.notes})` : ""}. ` +
        `Tap to accept all or part: ${responseLink(token)}`,
    });
  }

  return window;
}

export interface ResponseView {
  windowId: string;
  status: Window["status"];
  notes: string;
  startsAt: Date;
  endsAt: Date;
  respondentName: string;
  tier: Tier;
  expired: boolean;
  fullyCovered: boolean;
  /** Free gaps remaining in the window. */
  gaps: Interval[];
  /** Gaps this respondent may act on (tier-1: all; tier-2: only those meeting their minimum). */
  actionableGaps: Interval[];
  /** Whether this respondent currently has an active assignment for this window. */
  hasAssignment: boolean;
}

/** Build everything the no-login response page needs from a raw token, or null if unknown. */
export async function getResponseView(rawToken: string): Promise<ResponseView | null> {
  const token = await prisma.responseToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: {
      respondent: true,
      window: { include: { assignments: true } },
    },
  });
  if (!token) return null;

  const { window, respondent } = token;
  const gaps = computeGaps(windowInterval(window), coveredIntervals(window.assignments));
  const expired = token.revokedAt !== null || token.expiresAt < new Date();

  const actionableGaps =
    token.tier === "TIER2"
      ? gaps.filter((g) => minutes(g) >= respondent.minShiftMinutes)
      : gaps;

  const hasAssignment = window.assignments.some(
    (a) => a.respondentId === respondent.id,
  );

  return {
    windowId: window.id,
    status: window.status,
    notes: window.notes,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    respondentName: respondent.name,
    tier: token.tier,
    expired,
    fullyCovered: gaps.length === 0,
    gaps,
    actionableGaps,
    hasAssignment,
  };
}

export type ClaimResult =
  | { ok: true; filled: boolean; windowId: string }
  | { ok: false; reason: string; freeNow: Interval[] };

const ACTIVE_FOR: Record<Tier, Window["status"][]> = {
  TIER1: ["OPEN_TIER1", "ESCALATED_TIER2"],
  TIER2: ["ESCALATED_TIER2"],
};

/**
 * Claim time against a window via a response token. Runs at Serializable isolation
 * so concurrent claims on the same free time resolve first-come-wins; the loser
 * gets a conflict with refreshed availability. Retries a transient write conflict.
 */
export async function claimViaToken(rawToken: string, range: Interval): Promise<ClaimResult> {
  const token = await prisma.responseToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });
  if (!token) return { ok: false, reason: "This link is not valid.", freeNow: [] };
  if (token.revokedAt || token.expiresAt < new Date()) {
    return { ok: false, reason: "This link has expired.", freeNow: [] };
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const window = await tx.window.findUniqueOrThrow({
            where: { id: token.windowId },
            include: { assignments: true },
          });

          if (!ACTIVE_FOR[token.tier].includes(window.status)) {
            return {
              ok: false as const,
              reason: "This window is no longer accepting responses.",
              freeNow: [],
            };
          }

          const covered = coveredIntervals(window.assignments);
          const check = canClaim(windowInterval(window), covered, range, token.tier);
          if (!check.ok) {
            return { ok: false as const, reason: check.reason, freeNow: check.freeNow };
          }

          await tx.assignment.create({
            data: {
              windowId: window.id,
              respondentId: token.respondentId,
              tier: token.tier,
              startsAt: range.start,
              endsAt: range.end,
            },
          });

          const filled = isFullyCovered(windowInterval(window), [...covered, range]);
          if (filled) {
            await tx.window.update({ where: { id: window.id }, data: { status: "FILLED" } });
          }
          return { ok: true as const, filled, windowId: window.id };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "P2034" && attempt < 2) continue; // write conflict — retry
      throw error;
    }
  }
  return { ok: false, reason: "Could not claim due to contention. Please try again.", freeNow: [] };
}

export async function notifyIfFilled(windowId: string): Promise<void> {
  const window = await prisma.window.findUnique({ where: { id: windowId } });
  if (window?.status === "FILLED") {
    await notifyAdmin(
      `CareCover: ${formatRange(window.startsAt, window.endsAt)} is now fully covered. ✅`,
      windowId,
    );
  }
}

export async function unclaimViaToken(rawToken: string): Promise<{ ok: boolean; reason?: string }> {
  const token = await prisma.responseToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { respondent: true },
  });
  if (!token) return { ok: false, reason: "This link is not valid." };
  if (token.revokedAt || token.expiresAt < new Date()) {
    return { ok: false, reason: "This link has expired." };
  }

  const assignments = await prisma.assignment.findMany({
    where: { windowId: token.windowId, respondentId: token.respondentId },
  });
  if (assignments.length === 0) {
    return { ok: false, reason: "No active assignment found." };
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          await tx.assignment.deleteMany({
            where: { windowId: token.windowId, respondentId: token.respondentId },
          });

          const window = await tx.window.findUniqueOrThrow({
            where: { id: token.windowId },
            include: { assignments: true },
          });

          const wasFilled = window.status === "FILLED";
          const stillFilled = isFullyCovered(
            windowInterval(window),
            coveredIntervals(window.assignments),
          );

          if (wasFilled && !stillFilled) {
            const newStatus =
              window.tier1DeadlineAt > new Date() ? "OPEN_TIER1" : "ESCALATED_TIER2";
            await tx.window.update({
              where: { id: window.id },
              data: { status: newStatus },
            });
          }

          await tx.notificationLog.create({
            data: {
              windowId: token.windowId,
              respondentId: token.respondentId,
              channel: "event",
              body: `${token.respondent.name} canceled their coverage`,
              status: "SENT",
            },
          });

          if (env.ADMIN_PHONE) {
            const a = assignments[0];
            await sendSms({
              to: env.ADMIN_PHONE,
              body: `CareCover: ${token.respondent.name} can no longer cover ${formatRange(a.startsAt, a.endsAt)}. The gap is now open.`,
              windowId: token.windowId,
              respondentId: null,
            });
          }

          return { ok: true };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  return { ok: false, reason: "Could not cancel due to contention. Please try again." };
}

/** Record a decline for the audit trail. Declining never blocks others. */
export async function declineViaToken(rawToken: string): Promise<{ ok: boolean }> {
  const token = await prisma.responseToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { respondent: true },
  });
  if (!token) return { ok: false };
  await prisma.notificationLog.create({
    data: {
      windowId: token.windowId,
      respondentId: token.respondentId,
      channel: "event",
      body: `${token.respondent.name} declined`,
      status: "SENT",
    },
  });
  return { ok: true };
}
