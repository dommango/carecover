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

export interface RespondentStats {
  respondentId: string;
  claims: number;
  invites: number;
}

export async function getRespondentStats(): Promise<RespondentStats[]> {
  const respondents = await prisma.respondent.findMany({
    select: { id: true },
  });

  const stats: RespondentStats[] = [];
  for (const r of respondents) {
    const [claims, invites] = await Promise.all([
      prisma.assignment.count({ where: { respondentId: r.id } }),
      prisma.responseToken.count({ where: { respondentId: r.id } }),
    ]);

    stats.push({
      respondentId: r.id,
      claims,
      invites,
    });
  }

  return stats;
}
