import Link from "next/link";
import { requireAdmin } from "@/lib/guard";
import { listRespondents } from "@/lib/respondents";

export const dynamic = "force-dynamic";

const fieldClass = "rounded-md border border-black/15 px-2 py-1.5 text-sm";

export default async function RespondentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { error } = await searchParams;
  const respondents = await listRespondents();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Respondents</h1>
        <Link href="/" className="text-sm text-blue-700 hover:underline">
          ← Windows
        </Link>
      </header>

      {error === "phone" && (
        <p className="mb-4 text-sm text-red-600">That phone number didn&apos;t look valid.</p>
      )}

      <section className="mb-10 rounded-lg border border-black/10 p-5">
        <h2 className="mb-4 text-lg font-medium">Add a respondent</h2>
        <form
          method="post"
          action="/api/respondents"
          className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:items-end"
        >
          <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1">
            <span>Name</span>
            <input name="name" required className={fieldClass} />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1">
            <span>Phone</span>
            <input name="phone" placeholder="555-123-4567" required className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Tier</span>
            <select name="tier" defaultValue="TIER1" className={fieldClass}>
              <option value="TIER1">Family (Tier 1)</option>
              <option value="TIER2">Caregiver (Tier 2)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Min (min)</span>
            <input
              name="minShiftMinutes"
              type="number"
              min={15}
              max={1440}
              step={15}
              defaultValue={240}
              className={fieldClass}
            />
          </label>
          <input type="hidden" name="active" value="true" />
          <button className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white">
            Add
          </button>
        </form>
        <p className="mt-2 text-xs text-black/50">
          Minimum shift applies to caregivers only — gaps shorter than this aren&apos;t texted to
          them.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Everyone</h2>
        {respondents.length === 0 && <p className="text-sm text-black/50">No respondents yet.</p>}
        {respondents.map((r) => (
          <form
            key={r.id}
            method="post"
            action={`/api/respondents/${r.id}`}
            className="grid grid-cols-2 items-end gap-3 rounded-md border border-black/10 p-3 sm:grid-cols-6"
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-black/50">Name</span>
              <input name="name" defaultValue={r.name} className={fieldClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-black/50">Phone</span>
              <input name="phone" defaultValue={r.phone} className={fieldClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-black/50">Tier</span>
              <select name="tier" defaultValue={r.tier} className={fieldClass}>
                <option value="TIER1">Family (Tier 1)</option>
                <option value="TIER2">Caregiver (Tier 2)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-black/50">Min (min)</span>
              <input
                name="minShiftMinutes"
                type="number"
                min={15}
                max={1440}
                step={15}
                defaultValue={r.minShiftMinutes}
                className={fieldClass}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input name="active" type="checkbox" defaultChecked={r.active} />
              <span className="text-xs text-black/50">Active</span>
            </label>
            <button className="rounded-md border border-black/20 px-3 py-2 text-sm font-medium hover:bg-black/5">
              Save
            </button>
          </form>
        ))}
      </section>
    </main>
  );
}
