import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/time";
import { sendSms } from "@/lib/sms";
import { env } from "@/lib/env";
import type { RespondentInput } from "@/lib/validation";

// One-time opt-in/consent text sent the first time a respondent is added. It
// carries the brand, purpose, frequency disclosure, STOP/HELP, and a link to the
// program terms so consent is recorded before any coverage text goes out — this
// is the verifiable opt-in the A2P 10DLC campaign references.
export const optInBody = () =>
  "CareCover: You've been added to receive caregiving shift coordination texts. " +
  "Msg frequency varies; msg & data rates may apply. Reply STOP to opt out, HELP for help. " +
  `Terms: ${env.APP_BASE_URL}/terms`;

export function listRespondents() {
  return prisma.respondent.findMany({ orderBy: { name: "asc" } });
}

export function activeRespondents() {
  return prisma.respondent.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

export async function createRespondent(input: RespondentInput) {
  const respondent = await prisma.respondent.create({
    data: {
      name: input.name,
      phone: normalizePhone(input.phone),
      active: input.active,
    },
  });

  // Only the initial add triggers the opt-in, and only for reachable (active)
  // respondents. sendSms swallows provider failures, so a bad number never
  // blocks the respondent from being created.
  if (respondent.active) {
    await sendSms({ to: respondent.phone, respondentId: respondent.id, body: optInBody() });
  }

  return respondent;
}

export function updateRespondent(id: string, input: RespondentInput) {
  return prisma.respondent.update({
    where: { id },
    data: {
      name: input.name,
      phone: normalizePhone(input.phone),
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
