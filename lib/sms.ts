import twilio from "twilio";
import { prisma } from "@/lib/db";
import { env, smsEnabled } from "@/lib/env";

interface SendArgs {
  to: string;
  body: string;
  windowId?: string | null;
  respondentId?: string | null;
}

// Sends an SMS and records the attempt. A failed send is logged and swallowed so
// that one bad number never blocks the rest of an escalation blast — callers can
// inspect NotificationLog for failures.
export async function sendSms({ to, body, windowId, respondentId }: SendArgs): Promise<void> {
  if (!smsEnabled) {
    await prisma.notificationLog.create({
      data: { windowId, respondentId, body, status: "SENT", providerMessageId: `dev:${to}` },
    });
    return;
  }

  try {
    const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    const message = await client.messages.create({ to, from: env.TWILIO_FROM_NUMBER, body });
    await prisma.notificationLog.create({
      data: { windowId, respondentId, body, status: "SENT", providerMessageId: message.sid },
    });
  } catch (error) {
    await prisma.notificationLog.create({
      data: {
        windowId,
        respondentId,
        body,
        status: "FAILED",
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
}
