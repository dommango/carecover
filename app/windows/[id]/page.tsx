import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/guard";
import { getWindowDetail } from "@/lib/admin";
import { listRespondents } from "@/lib/respondents";
import { formatDate, formatRange, formatTime, toLocalInputValue } from "@/lib/time";
import { CoverageBar } from "@/components/coverage-bar";

export const dynamic = "force-dynamic";

export default async function WindowDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string; resent?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { ok, error, resent } = await searchParams;
  const w = await getWindowDetail(id);
  if (!w) notFound();

  const respondents = (await listRespondents()).filter((r) => r.active);
  const active = w.status === "OPEN_TIER1" || w.status === "ESCALATED_TIER2";
  const assignFrom = w.gaps[0]?.start ?? w.startsAt;
  const assignTo = w.gaps[0]?.end ?? w.endsAt;
  const windowMin = toLocalInputValue(w.startsAt);
  const windowMax = toLocalInputValue(w.endsAt);

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-blue-700 hover:underline">
          ← Windows
        </Link>
      </header>

      {ok === "assigned" && <p className="mb-4 text-sm text-emerald-700">Assignment added.</p>}
      {resent && <p className="mb-4 text-sm text-emerald-700">Reminder texts sent.</p>}
      {error && <p className="mb-4 text-sm text-red-600">That time isn&apos;t available.</p>}

      <h1 className="text-xl font-semibold">{formatRange(w.startsAt, w.endsAt)}</h1>
      {w.notes && <p className="mt-1 text-black/60">{w.notes}</p>}
      <p className="mt-1 text-sm text-black/50">
        Family deadline (Tier 1): {formatDate(w.tier1DeadlineAt)} at {formatTime(w.tier1DeadlineAt)} ·{" "}
        {w.coveredPercent}% covered
      </p>

      <div className="my-5">
        <CoverageBar
          startsAt={w.startsAt}
          endsAt={w.endsAt}
          assignments={w.assignments}
          gaps={w.gaps}
        />
      </div>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50">Covered</h2>
        {w.assignments.length === 0 && <p className="text-sm text-black/50">Nothing yet.</p>}
        <ul className="flex flex-col gap-1 text-sm">
          {w.assignments.map((a) => (
            <li key={a.id} className="flex justify-between">
              <span>
                {a.respondentName}{" "}
                <span className="text-black/40">({a.tier === "TIER1" ? "family" : "caregiver"})</span>
              </span>
              <span>
                {formatTime(a.startsAt)}–{formatTime(a.endsAt)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {w.gaps.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50">
            Open gaps
          </h2>
          <ul className="flex flex-col gap-1 text-sm">
            {w.gaps.map((g, i) => {
              const flagged = w.flaggedGaps.some(
                (f) => f.start.getTime() === g.start.getTime() && f.end.getTime() === g.end.getTime(),
              );
              return (
                <li key={i} className="flex justify-between">
                  <span>
                    {formatTime(g.start)}–{formatTime(g.end)}
                  </span>
                  {flagged && <span className="text-red-600">too short for caregivers</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {active && (
        <section className="mb-6 rounded-lg border border-black/10 p-4">
          <h2 className="mb-3 text-sm font-semibold">Assign someone manually</h2>
          <form
            method="post"
            action={`/api/windows/${w.id}/assign`}
            className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end"
          >
            <label className="flex flex-col gap-1 text-sm">
              <span>Person</span>
              <select name="respondentId" className="rounded-md border border-black/15 px-2 py-1.5">
                {respondents.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.tier === "TIER1" ? "family" : "caregiver"})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>From</span>
              <input
                type="datetime-local"
                name="startsAtLocal"
                min={windowMin}
                max={windowMax}
                step={900}
                defaultValue={toLocalInputValue(assignFrom)}
                className="rounded-md border border-black/15 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>To</span>
              <input
                type="datetime-local"
                name="endsAtLocal"
                min={windowMin}
                max={windowMax}
                step={900}
                defaultValue={toLocalInputValue(assignTo)}
                className="rounded-md border border-black/15 px-2 py-1.5"
              />
            </label>
            <button className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white sm:col-span-3">
              Assign
            </button>
          </form>
        </section>
      )}

      {active && (
        <section className="flex gap-3">
          <form method="post" action={`/api/windows/${w.id}/resend`}>
            <button className="rounded-md border border-black/20 px-3 py-2 text-sm hover:bg-black/5">
              Re-send texts
            </button>
          </form>
          <form method="post" action={`/api/windows/${w.id}/close`}>
            <button className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50">
              Close window
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
