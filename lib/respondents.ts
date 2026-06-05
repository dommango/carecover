import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/time";
import type { RespondentInput } from "@/lib/validation";
import type { Tier } from "@/generated/prisma/client";

export function listRespondents() {
  return prisma.respondent.findMany({ orderBy: [{ tier: "asc" }, { name: "asc" }] });
}

export function activeRespondentsByTier(tier: Tier) {
  return prisma.respondent.findMany({ where: { tier, active: true }, orderBy: { name: "asc" } });
}

export function createRespondent(input: RespondentInput) {
  return prisma.respondent.create({
    data: {
      name: input.name,
      phone: normalizePhone(input.phone),
      tier: input.tier,
      minShiftMinutes: input.minShiftMinutes,
      active: input.active,
    },
  });
}

export function updateRespondent(id: string, input: RespondentInput) {
  return prisma.respondent.update({
    where: { id },
    data: {
      name: input.name,
      phone: normalizePhone(input.phone),
      tier: input.tier,
      minShiftMinutes: input.minShiftMinutes,
      active: input.active,
    },
  });
}
