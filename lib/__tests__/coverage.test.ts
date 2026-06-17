import { describe, it, expect } from "vitest";
import {
  minutes,
  computeGaps,
  isFullyCovered,
  eligibleCaregivers,
  canClaim,
  escalationPlan,
  type Interval,
  type Caregiver,
} from "@/lib/coverage";

// Helper: build a Date at a given hour:minute on a fixed reference day.
const at = (h: number, m = 0) => new Date(Date.UTC(2026, 0, 1, h, m));
const iv = (sh: number, eh: number): Interval => ({ start: at(sh), end: at(eh) });

const cg = (id: string, minShiftMinutes: number): Caregiver => ({ id, minShiftMinutes });

describe("minutes", () => {
  it("returns the length of an interval in minutes", () => {
    expect(minutes(iv(9, 13))).toBe(240);
    expect(minutes({ start: at(9), end: at(9, 30) })).toBe(30);
  });
});

describe("computeGaps", () => {
  const win = iv(9, 17); // 9am–5pm

  it("returns the whole window when nothing is covered", () => {
    expect(computeGaps(win, [])).toEqual([iv(9, 17)]);
  });

  it("returns no gaps when fully covered", () => {
    expect(computeGaps(win, [iv(9, 17)])).toEqual([]);
  });

  it("returns a trailing gap when only the start is covered", () => {
    expect(computeGaps(win, [iv(9, 13)])).toEqual([iv(13, 17)]);
  });

  it("returns a leading gap when only the end is covered", () => {
    expect(computeGaps(win, [iv(13, 17)])).toEqual([iv(9, 13)]);
  });

  it("returns two gaps when coverage is split in the middle", () => {
    // sisters cover 9–11 and 14–17, leaving 11–14
    expect(computeGaps(win, [iv(9, 11), iv(14, 17)])).toEqual([iv(11, 14)]);
  });

  it("returns multiple disjoint gaps", () => {
    // cover 10–11 and 13–14 -> gaps 9–10, 11–13, 14–17
    expect(computeGaps(win, [iv(10, 11), iv(13, 14)])).toEqual([
      iv(9, 10),
      iv(11, 13),
      iv(14, 17),
    ]);
  });

  it("merges overlapping coverage", () => {
    expect(computeGaps(win, [iv(9, 12), iv(11, 14)])).toEqual([iv(14, 17)]);
  });

  it("merges adjacent coverage without spurious zero-length gaps", () => {
    expect(computeGaps(win, [iv(9, 12), iv(12, 15)])).toEqual([iv(15, 17)]);
  });

  it("clamps coverage that extends beyond the window", () => {
    expect(computeGaps(win, [iv(7, 10), iv(16, 19)])).toEqual([iv(10, 16)]);
  });

  it("ignores coverage entirely outside the window", () => {
    expect(computeGaps(win, [iv(6, 8)])).toEqual([iv(9, 17)]);
  });

  it("ignores unsorted input order", () => {
    expect(computeGaps(win, [iv(14, 17), iv(9, 11)])).toEqual([iv(11, 14)]);
  });
});

describe("isFullyCovered", () => {
  const win = iv(9, 17);
  it("is true when no gaps remain", () => {
    expect(isFullyCovered(win, [iv(9, 17)])).toBe(true);
    expect(isFullyCovered(win, [iv(9, 13), iv(13, 17)])).toBe(true);
  });
  it("is false when any gap remains", () => {
    expect(isFullyCovered(win, [iv(9, 13)])).toBe(false);
    expect(isFullyCovered(win, [])).toBe(false);
  });
});

describe("eligibleCaregivers", () => {
  const caregivers = [cg("a", 240), cg("b", 120), cg("c", 480)];

  it("keeps caregivers whose minimum fits the gap", () => {
    const gap = iv(9, 13); // 240 min
    expect(eligibleCaregivers(gap, caregivers).map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("excludes everyone when the gap is shorter than all minimums", () => {
    const gap = { start: at(9), end: at(10) }; // 60 min
    expect(eligibleCaregivers(gap, caregivers)).toEqual([]);
  });

  it("includes a caregiver when the gap exactly equals their minimum", () => {
    const gap = iv(9, 11); // 120 min
    expect(eligibleCaregivers(gap, caregivers).map((c) => c.id)).toEqual(["b"]);
  });
});

describe("canClaim — PARTIAL (free sub-range)", () => {
  const win = iv(9, 17);

  it("accepts a sub-range inside free time", () => {
    const r = canClaim(win, [], iv(9, 12), "PARTIAL");
    expect(r.ok).toBe(true);
  });

  it("accepts a sub-range that fits between existing coverage", () => {
    const r = canClaim(win, [iv(9, 11), iv(14, 17)], iv(11, 14), "PARTIAL");
    expect(r.ok).toBe(true);
  });

  it("rejects a range overlapping existing coverage and reports free time", () => {
    const r = canClaim(win, [iv(9, 12)], iv(11, 14), "PARTIAL");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.freeNow).toEqual([iv(12, 17)]);
  });

  it("rejects a range outside the window bounds", () => {
    expect(canClaim(win, [], iv(8, 10), "PARTIAL").ok).toBe(false);
    expect(canClaim(win, [], iv(16, 18), "PARTIAL").ok).toBe(false);
  });

  it("rejects an empty or inverted range", () => {
    expect(canClaim(win, [], { start: at(10), end: at(10) }, "PARTIAL").ok).toBe(false);
    expect(canClaim(win, [], { start: at(12), end: at(10) }, "PARTIAL").ok).toBe(false);
  });
});

describe("canClaim — WHOLE_GAP (all-or-nothing)", () => {
  const win = iv(9, 17);

  it("accepts a request that exactly matches a current gap", () => {
    const r = canClaim(win, [iv(9, 11), iv(14, 17)], iv(11, 14), "WHOLE_GAP");
    expect(r.ok).toBe(true);
  });

  it("rejects a partial slice of a gap", () => {
    const r = canClaim(win, [iv(9, 11), iv(14, 17)], iv(11, 13), "WHOLE_GAP");
    expect(r.ok).toBe(false);
  });

  it("rejects a range spanning across covered time", () => {
    const r = canClaim(win, [iv(11, 12)], iv(9, 17), "WHOLE_GAP");
    expect(r.ok).toBe(false);
  });
});

describe("escalationPlan", () => {
  const win = iv(9, 17);
  const caregivers = [cg("a", 240), cg("b", 120)];

  it("texts caregivers for gaps that meet a minimum and flags the rest", () => {
    // sisters covered 9–11 and 12:30–17, leaving 11–12:30 (90 min) -> too short for all
    const covered = [iv(9, 11), { start: at(12, 30), end: at(17) }];
    const plan = escalationPlan(win, covered, caregivers);
    expect(plan.gapsToText).toEqual([]);
    expect(plan.gapsToFlag).toEqual([{ start: at(11), end: at(12, 30) }]);
  });

  it("routes a long gap to eligible caregivers", () => {
    const covered = [iv(9, 11)]; // gap 11–17 = 360 min
    const plan = escalationPlan(win, covered, caregivers);
    expect(plan.gapsToFlag).toEqual([]);
    expect(plan.gapsToText).toHaveLength(1);
    expect(plan.gapsToText[0].gap).toEqual(iv(11, 17));
    expect(plan.gapsToText[0].caregivers.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("handles mixed gaps: one textable, one flagged", () => {
    // cover 10–10:30 -> gaps 9–10 (60m, flag) and 10:30–17 (390m, text)
    const covered = [{ start: at(10), end: at(10, 30) }];
    const plan = escalationPlan(win, covered, caregivers);
    expect(plan.gapsToFlag).toEqual([iv(9, 10)]);
    expect(plan.gapsToText.map((g) => g.gap)).toEqual([{ start: at(10, 30), end: at(17) }]);
  });

  it("texts every gap and flags none for a PARTIAL tier (members stamped with min 0)", () => {
    // A PARTIAL escalation tier has no minimum shift: the caller stamps minShiftMinutes 0,
    // so even a tiny 60-min gap is textable rather than flagged.
    const partialMembers = [cg("p1", 0), cg("p2", 0)];
    const covered = [{ start: at(10), end: at(10, 30) }]; // gaps 9–10 (60m) and 10:30–17
    const plan = escalationPlan(win, covered, partialMembers);
    expect(plan.gapsToFlag).toEqual([]);
    expect(plan.gapsToText.map((g) => g.gap)).toEqual([
      iv(9, 10),
      { start: at(10, 30), end: at(17) },
    ]);
  });
});
