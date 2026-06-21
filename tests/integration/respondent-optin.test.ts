import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createRespondent, updateRespondent } from "@/lib/respondents";

// Twilio is unconfigured in tests, so the opt-in SMS is recorded to
// NotificationLog (see lib/sms.ts dev path) rather than sent.

async function reset() {
  await prisma.notificationLog.deleteMany();
  await prisma.respondent.deleteMany();
}

beforeEach(reset);
afterAll(async () => {
  await reset();
  await prisma.$disconnect();
});

async function optInLogs(respondentId: string) {
  return prisma.notificationLog.findMany({ where: { respondentId, windowId: null } });
}

describe("respondent opt-in SMS", () => {
  it("texts a single opt-in message when an active respondent is added", async () => {
    const r = await createRespondent({ name: "Aunt May", phone: "555-000-0001", active: true });

    const logs = await optInLogs(r.id);
    expect(logs).toHaveLength(1);
    expect(logs[0].channel).toBe("sms");
    expect(logs[0].status).toBe("SENT");
    expect(logs[0].windowId).toBeNull();
    expect(logs[0].body).toMatch(/CareCover/);
    expect(logs[0].body).toMatch(/Reply STOP to opt out/i);
    expect(logs[0].body).toMatch(/HELP/i);
    expect(logs[0].body).toMatch(/\/terms/);
  });

  it("does not text an opt-in when the respondent is added inactive", async () => {
    const r = await createRespondent({ name: "Inactive Ian", phone: "555-000-0002", active: false });
    expect(await optInLogs(r.id)).toHaveLength(0);
  });

  it("does not re-send an opt-in on update (opt-in is one-time, on add only)", async () => {
    const r = await createRespondent({ name: "Cousin Cara", phone: "555-000-0003", active: true });
    await updateRespondent(r.id, { name: "Cousin Cara", phone: "555-000-0004", active: true });
    expect(await optInLogs(r.id)).toHaveLength(1);
  });
});
