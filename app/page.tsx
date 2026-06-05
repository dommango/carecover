import Link from "next/link";
import { requireAdmin } from "@/lib/guard";
import { getAdminWindows, type WindowSummary } from "@/lib/admin";
import { formatRange, formatTime, toLocalInputValue } from "@/lib/time";
import { CoverageBar } from "@/components/coverage-bar";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<WindowSummary["status"], string> = {
  OPEN_TIER1: "bg-blue-100 text-blue-800",
  ESCALATED_TIER2: "bg-amber-100 text-amber-900",
  FILLED: "bg-emerald-100 text-emerald-800",
  CLOSED: "bg-gray-200 text-gray-700",
  EXPIRED: "bg-gray-200 text-gray-700",
};

const STATUS_LABEL: Record<WindowSummary["status"], string> = {
  OPEN_TIER1: "Awaiting sisters",
  ESCALATED_TIER2: "With caregivers",
  FILLED: "Filled",
  CLOSED: "Closed",
  EXPIRED: "Expired",
};

export default async function DashboardPage() {
  await requireAdmin();
  const windows = await getAdminWindows();

  const now = new Date();
  const defaultStart = toLocalInputValue(new Date(now.getTime() + 60 * 60 * 1000));
  const defaultEnd = toLocalInputValue(new Date(now.getTime() + 5 * 60 * 60 * 1000));

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">CareCover</h1>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/respondents" className="text-blue-700 hover:underline">
            Respondents
          </Link>
          <form method="post" action="/api/logout">
            <button className="text-black/60 hover:underline">Sign out</button>
          </form>
        </nav>
      </header>

      <section className="mb-10 rounded-lg border border-black/10 p-5">
        <h2 className="mb-4 text-lg font-medium">Post a coverage window</h2>
        <form method="post" action="/api/windows" className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Start</span>
            <input
              type="datetime-local"
              name="startsAtLocal"
              defaultValue={defaultStart}
              required
              className="rounded-md border border-black/15 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">End</span>
            <input
              type="datetime-local"
              name="endsAtLocal"
              defaultValue={defaultEnd}
              required
              className="rounded-md border border-black/15 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium">Notes (what&apos;s needed)</span>
            <input
              type="text"
              name="notes"
              placeholder="e.g. lunch + meds, no driving"
              className="rounded-md border border-black/15 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium">Sisters&apos; deadline (optional)</span>
            <input
              type="datetime-local"
              name="tier1DeadlineLocal"
              className="rounded-md border border-black/15 px-3 py-2"
            />
            <span className="text-xs text-black/50">
              If left blank, caregivers are contacted automatically after the default window.
            </span>
          </label>
          <div className="sm:col-span-2">
            <button className="rounded-md bg-black px-4 py-2 font-medium text-white">
              Post &amp; text sisters
            </button>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Windows</h2>
        {windows.length === 0 && <p className="text-sm text-black/50">No windows yet.</p>}
        {windows.map((w) => (
          <Link
            key={w.id}
            href={`/windows/${w.id}`}
            className="block rounded-lg border border-black/10 p-4 transition hover:border-black/30"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="font-medium">{formatRange(w.startsAt, w.endsAt)}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[w.status]}`}>
                {STATUS_LABEL[w.status]} · {w.coveredPercent}%
              </span>
            </div>
            {w.notes && <p className="mb-2 text-sm text-black/60">{w.notes}</p>}
            <CoverageBar
              startsAt={w.startsAt}
              endsAt={w.endsAt}
              assignments={w.assignments}
              gaps={w.gaps}
            />
            {w.flaggedGaps.length > 0 && (
              <p className="mt-2 text-xs text-red-600">
                {w.flaggedGaps.length} gap(s) too short for caregivers —{" "}
                {w.flaggedGaps.map((g) => `${formatTime(g.start)}–${formatTime(g.end)}`).join(", ")}
              </p>
            )}
          </Link>
        ))}
      </section>
    </main>
  );
}
