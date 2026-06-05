import { getResponseView } from "@/lib/windows";
import { formatRange, formatTime, toLocalInputValue } from "@/lib/time";

export const dynamic = "force-dynamic";

const STATUS_MESSAGE: Record<string, { text: string; tone: "good" | "bad" }> = {
  claimed: { text: "Thanks — your time is locked in. ✅", tone: "good" },
  declined: { text: "Got it, thanks for letting us know.", tone: "good" },
  conflict: { text: "Sorry — someone just grabbed that time. Here's what's still open.", tone: "bad" },
  invalid: { text: "That didn't look right. Please try again.", tone: "bad" },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-md px-6 py-10">
      <h1 className="mb-6 text-xl font-semibold">CareCover</h1>
      {children}
    </main>
  );
}

export default async function RespondPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { token } = await params;
  const { status } = await searchParams;
  const view = await getResponseView(token);

  if (!view) {
    return (
      <Shell>
        <p className="text-black/70">This link isn&apos;t valid. Please ask for a new one.</p>
      </Shell>
    );
  }

  const message = status ? STATUS_MESSAGE[status] : undefined;
  const closed = view.expired || view.fullyCovered || view.status === "FILLED" || view.status === "CLOSED";
  const isTier2 = view.tier === "TIER2";

  return (
    <Shell>
      <p className="text-sm text-black/50">Hi {view.respondentName} —</p>
      <h2 className="mt-1 text-lg font-medium">{formatRange(view.startsAt, view.endsAt)}</h2>
      {view.notes && <p className="mt-1 text-black/60">{view.notes}</p>}

      {message && (
        <p
          className={`mt-4 rounded-md px-3 py-2 text-sm ${
            message.tone === "good" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
          }`}
        >
          {message.text}
        </p>
      )}

      {closed ? (
        <p className="mt-6 text-black/70">
          {view.expired
            ? "This request has expired."
            : view.fullyCovered || view.status === "FILLED"
              ? "This window is fully covered — nothing needed. Thank you!"
              : "This window is closed."}
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {view.actionableGaps.length === 0 && (
            <p className="text-black/70">
              {isTier2
                ? "No open block currently matches your minimum shift."
                : "Everything is currently covered."}
            </p>
          )}

          {isTier2
            ? view.actionableGaps.map((gap, i) => (
                <form
                  key={i}
                  method="post"
                  action={`/api/respond/${token}`}
                  className="rounded-lg border border-black/10 p-4"
                >
                  <input type="hidden" name="action" value="claim" />
                  <input type="hidden" name="startsAtLocal" value={toLocalInputValue(gap.start)} />
                  <input type="hidden" name="endsAtLocal" value={toLocalInputValue(gap.end)} />
                  <p className="mb-3 font-medium">
                    {formatTime(gap.start)} – {formatTime(gap.end)}
                  </p>
                  <button className="w-full rounded-md bg-black px-3 py-2 font-medium text-white">
                    Take this full block
                  </button>
                </form>
              ))
            : view.actionableGaps.map((gap, i) => (
                <form
                  key={i}
                  method="post"
                  action={`/api/respond/${token}`}
                  className="rounded-lg border border-black/10 p-4"
                >
                  <input type="hidden" name="action" value="claim" />
                  <p className="mb-2 text-sm text-black/60">
                    Open: {formatTime(gap.start)} – {formatTime(gap.end)}. Cover all or part:
                  </p>
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 text-xs">
                      <span>From</span>
                      <input
                        type="datetime-local"
                        name="startsAtLocal"
                        min={toLocalInputValue(gap.start)}
                        max={toLocalInputValue(gap.end)}
                        step={900}
                        defaultValue={toLocalInputValue(gap.start)}
                        className="rounded-md border border-black/15 px-2 py-1.5"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      <span>To</span>
                      <input
                        type="datetime-local"
                        name="endsAtLocal"
                        min={toLocalInputValue(gap.start)}
                        max={toLocalInputValue(gap.end)}
                        step={900}
                        defaultValue={toLocalInputValue(gap.end)}
                        className="rounded-md border border-black/15 px-2 py-1.5"
                      />
                    </label>
                  </div>
                  <button className="w-full rounded-md bg-black px-3 py-2 font-medium text-white">
                    Accept this time
                  </button>
                </form>
              ))}

          <form method="post" action={`/api/respond/${token}`}>
            <input type="hidden" name="action" value="decline" />
            <button className="w-full rounded-md border border-black/20 px-3 py-2 text-black/70 hover:bg-black/5">
              Can&apos;t help with this one
            </button>
          </form>
        </div>
      )}
    </Shell>
  );
}
