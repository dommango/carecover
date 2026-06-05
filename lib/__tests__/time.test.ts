import { describe, it, expect } from "vitest";
import { normalizePhone, zonedWallTimeToUtc, formatRange, toLocalInputValue } from "@/lib/time";

describe("normalizePhone", () => {
  it("adds +1 to a bare 10-digit US number", () => {
    expect(normalizePhone("5551234567")).toBe("+15551234567");
  });
  it("strips formatting from a US number", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("+15551234567");
  });
  it("handles a leading-1 11-digit number", () => {
    expect(normalizePhone("1 555 123 4567")).toBe("+15551234567");
  });
  it("passes through a valid +E.164 number", () => {
    expect(normalizePhone("+447911123456")).toBe("+447911123456");
  });
  it("rejects too-short input", () => {
    expect(() => normalizePhone("123")).toThrow();
  });
});

describe("zonedWallTimeToUtc (America/New_York)", () => {
  it("converts a summer (EDT, UTC-4) wall time", () => {
    expect(zonedWallTimeToUtc("2026-06-10T09:00", "America/New_York").toISOString()).toBe(
      "2026-06-10T13:00:00.000Z",
    );
  });
  it("converts a winter (EST, UTC-5) wall time", () => {
    expect(zonedWallTimeToUtc("2026-01-10T09:00", "America/New_York").toISOString()).toBe(
      "2026-01-10T14:00:00.000Z",
    );
  });
});

describe("toLocalInputValue ↔ zonedWallTimeToUtc round-trip", () => {
  // Load-bearing for tier-2 claims: the response page renders a gap's instants via
  // toLocalInputValue into hidden inputs, and the server converts them back with
  // zonedWallTimeToUtc. If this doesn't round-trip exactly, the exact-gap-match
  // check rejects every real caregiver claim.
  const tz = "America/New_York";
  const instants = [
    "2026-06-10T13:00:00.000Z", // 9:00 EDT
    "2026-06-10T21:30:00.000Z", // 5:30 EDT
    "2026-01-10T14:00:00.000Z", // 9:00 EST
    "2026-12-31T05:00:00.000Z", // midnight EST
  ];
  for (const iso of instants) {
    it(`round-trips ${iso}`, () => {
      const d = new Date(iso);
      expect(zonedWallTimeToUtc(toLocalInputValue(d, tz), tz).toISOString()).toBe(iso);
    });
  }
});

describe("formatRange", () => {
  it("collapses a same-day range to one date", () => {
    const start = new Date("2026-06-10T13:00:00.000Z"); // 9am EDT
    const end = new Date("2026-06-10T17:00:00.000Z"); // 1pm EDT
    const out = formatRange(start, end, "America/New_York");
    expect(out).toContain("9:00");
    expect(out).toContain("1:00");
    expect(out.match(/Jun 10/g)?.length).toBe(1);
  });
});
