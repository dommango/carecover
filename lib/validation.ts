import { z } from "zod";
import { TASK_TAGS } from "@/lib/task-tags";

const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, "Expected a datetime-local value.");

export const respondentSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(7).max(20),
  active: z.coerce.boolean().default(true),
});
export type RespondentInput = z.infer<typeof respondentSchema>;

export const tierConfigSchema = z.object({
  label: z.string().trim().max(40).optional(),
  claimRule: z.enum(["PARTIAL", "WHOLE_GAP"]),
  minShiftMinutes: z.coerce.number().int().min(15).max(1440).default(240),
  // Hours before the shift starts that this tier escalates to the next. Omitted
  // for the last tier (terminal — never escalates).
  leadHours: z.coerce.number().min(0).max(720).optional(),
  respondentIds: z.array(z.string().cuid()).default([]),
});
export type TierConfigInput = z.infer<typeof tierConfigSchema>;

export const createWindowSchema = z
  .object({
    startsAtLocal: localDateTime,
    endsAtLocal: localDateTime,
    notes: z.string().trim().max(500).default(""),
    taskTags: z.array(z.enum(TASK_TAGS)).default([]),
    tiers: z.array(tierConfigSchema).min(1, "At least one tier is required."),
  })
  .superRefine((v, ctx) => {
    if (v.endsAtLocal <= v.startsAtLocal) {
      ctx.addIssue({ code: "custom", message: "End must be after start.", path: ["endsAtLocal"] });
    }
    v.tiers.forEach((tier, i) => {
      const isLast = i === v.tiers.length - 1;
      if (!isLast && (tier.leadHours === undefined || tier.leadHours === null)) {
        ctx.addIssue({
          code: "custom",
          message: "Every tier except the last needs an escalation time.",
          path: ["tiers", i, "leadHours"],
        });
      }
    });
    // Lead times must strictly decrease so deadlines are monotonic down the ladder.
    for (let i = 1; i < v.tiers.length - 1; i++) {
      const prev = v.tiers[i - 1].leadHours;
      const cur = v.tiers[i].leadHours;
      if (prev !== undefined && cur !== undefined && cur >= prev) {
        ctx.addIssue({
          code: "custom",
          message: "Each tier must escalate later than the one before it.",
          path: ["tiers", i, "leadHours"],
        });
      }
    }
    // A respondent may appear in at most one tier of a window is NOT required:
    // multi-tier membership is allowed (they get one link per tier).
  });
export type CreateWindowInput = z.infer<typeof createWindowSchema>;

export const claimSchema = z
  .object({
    startsAtLocal: localDateTime,
    endsAtLocal: localDateTime,
  })
  .refine((v) => v.endsAtLocal > v.startsAtLocal, {
    message: "End must be after start.",
    path: ["endsAtLocal"],
  });
export type ClaimInput = z.infer<typeof claimSchema>;

export const loginSchema = z.object({ password: z.string().min(1) });
