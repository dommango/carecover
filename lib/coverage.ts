// Pure coverage logic for CareCover. No I/O — every function is a plain
// transformation over intervals, so the tricky scheduling rules are unit-testable
// in isolation. Times are real Dates; callers pass UTC instants.

export interface Interval {
  start: Date;
  end: Date;
}

export interface Caregiver {
  id: string;
  minShiftMinutes: number;
}

/** Length of an interval in whole minutes. */
export function minutes(interval: Interval): number {
  return Math.round((interval.end.getTime() - interval.start.getTime()) / 60_000);
}

/**
 * Free intervals remaining inside `window` after subtracting `covered`.
 * Coverage is clamped to the window, merged across overlaps/adjacency, and
 * subtracted. Result is sorted and contains no zero-length gaps.
 */
export function computeGaps(window: Interval, covered: Interval[]): Interval[] {
  const windowStart = window.start.getTime();
  const windowEnd = window.end.getTime();

  const clamped = covered
    .map((c) => ({
      start: Math.max(c.start.getTime(), windowStart),
      end: Math.min(c.end.getTime(), windowEnd),
    }))
    .filter((c) => c.end > c.start)
    .sort((a, b) => a.start - b.start);

  const merged: { start: number; end: number }[] = [];
  for (const block of clamped) {
    const last = merged[merged.length - 1];
    if (last && block.start <= last.end) {
      merged[merged.length - 1] = { start: last.start, end: Math.max(last.end, block.end) };
    } else {
      merged.push({ start: block.start, end: block.end });
    }
  }

  const gaps: Interval[] = [];
  let cursor = windowStart;
  for (const block of merged) {
    if (block.start > cursor) {
      gaps.push({ start: new Date(cursor), end: new Date(block.start) });
    }
    cursor = Math.max(cursor, block.end);
  }
  if (cursor < windowEnd) {
    gaps.push({ start: new Date(cursor), end: new Date(windowEnd) });
  }
  return gaps;
}

/** True when no free time remains in the window. */
export function isFullyCovered(window: Interval, covered: Interval[]): boolean {
  return computeGaps(window, covered).length === 0;
}

/** Caregivers whose minimum shift fits within the given gap. */
export function eligibleCaregivers(gap: Interval, caregivers: Caregiver[]): Caregiver[] {
  const gapMinutes = minutes(gap);
  return caregivers.filter((c) => c.minShiftMinutes <= gapMinutes);
}

export type ClaimCheck =
  | { ok: true; range: Interval }
  | { ok: false; reason: string; freeNow: Interval[] };

/**
 * Validate a claim against the window's current free time.
 * - TIER1 (sisters): any sub-range that fits entirely within a single free gap.
 * - TIER2 (caregivers): must take an entire open gap, all-or-nothing.
 * On rejection, `freeNow` reflects the currently-available gaps so the UI can refresh.
 */
export function canClaim(
  window: Interval,
  covered: Interval[],
  requested: Interval,
  tier: "TIER1" | "TIER2",
): ClaimCheck {
  const gaps = computeGaps(window, covered);
  const requestStart = requested.start.getTime();
  const requestEnd = requested.end.getTime();
  const reject = (reason: string): ClaimCheck => ({ ok: false, reason, freeNow: gaps });

  if (requestEnd <= requestStart) return reject("Start must be before end.");
  if (requestStart < window.start.getTime() || requestEnd > window.end.getTime()) {
    return reject("Requested time is outside the window.");
  }

  if (tier === "TIER2") {
    const matchesGap = gaps.some(
      (g) => g.start.getTime() === requestStart && g.end.getTime() === requestEnd,
    );
    return matchesGap
      ? { ok: true, range: requested }
      : reject("Caregivers must take an entire open gap.");
  }

  const fitsInGap = gaps.some(
    (g) => requestStart >= g.start.getTime() && requestEnd <= g.end.getTime(),
  );
  return fitsInGap
    ? { ok: true, range: requested }
    : reject("That time overlaps coverage already claimed.");
}

export interface EscalationPlan {
  gapsToText: { gap: Interval; caregivers: Caregiver[] }[];
  gapsToFlag: Interval[];
}

/**
 * Decide, per remaining gap, which caregivers (if any) to text. Gaps shorter
 * than every eligible caregiver's minimum are flagged for the admin to handle
 * manually rather than blasted out.
 */
export function escalationPlan(
  window: Interval,
  covered: Interval[],
  caregivers: Caregiver[],
): EscalationPlan {
  const gapsToText: { gap: Interval; caregivers: Caregiver[] }[] = [];
  const gapsToFlag: Interval[] = [];

  for (const gap of computeGaps(window, covered)) {
    const eligible = eligibleCaregivers(gap, caregivers);
    if (eligible.length > 0) {
      gapsToText.push({ gap, caregivers: eligible });
    } else {
      gapsToFlag.push(gap);
    }
  }

  return { gapsToText, gapsToFlag };
}
