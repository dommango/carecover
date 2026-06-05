import { z } from "zod";

const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, "Expected a datetime-local value.");

export const respondentSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(7).max(20),
  tier: z.enum(["TIER1", "TIER2"]),
  minShiftMinutes: z.coerce.number().int().min(15).max(1440).default(240),
  active: z.coerce.boolean().default(true),
});
export type RespondentInput = z.infer<typeof respondentSchema>;

export const createWindowSchema = z
  .object({
    startsAtLocal: localDateTime,
    endsAtLocal: localDateTime,
    notes: z.string().trim().max(500).default(""),
    tier1DeadlineLocal: localDateTime.optional(),
  })
  .refine((v) => v.endsAtLocal > v.startsAtLocal, {
    message: "End must be after start.",
    path: ["endsAtLocal"],
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
