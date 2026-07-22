import { describe, it, expect } from "vitest";
import { createWindowSchema } from "@/lib/validation";

const base = {
  startsAtLocal: "2026-08-01T09:00",
  endsAtLocal: "2026-08-01T17:00",
  tiers: [{ claimRule: "PARTIAL" }],
};

describe("createWindowSchema taskTags", () => {
  it("defaults to an empty list", () => {
    const parsed = createWindowSchema.parse(base);
    expect(parsed.taskTags).toEqual([]);
  });

  it("accepts known preset tags", () => {
    const parsed = createWindowSchema.parse({ ...base, taskTags: ["MEALS", "TRANSPORT"] });
    expect(parsed.taskTags).toEqual(["MEALS", "TRANSPORT"]);
  });

  it("rejects values outside the preset vocabulary", () => {
    const result = createWindowSchema.safeParse({ ...base, taskTags: ["MEDICATION"] });
    expect(result.success).toBe(false);
  });
});
