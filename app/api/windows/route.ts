import { NextRequest } from "next/server";
import { isAdmin } from "@/lib/auth";
import { createWindowSchema } from "@/lib/validation";
import { isTaskTag } from "@/lib/task-tags";
import { zonedWallTimeToUtc } from "@/lib/time";
import { createWindow } from "@/lib/windows";
import { appRedirect } from "@/lib/http";

/** Reconstruct the ordered tier list from indexed `tiers[i][field]` form fields. */
function parseTiers(form: FormData) {
  const indices = new Set<number>();
  for (const key of form.keys()) {
    const m = key.match(/^tiers\[(\d+)\]\[/);
    if (m) indices.add(Number(m[1]));
  }
  const orNull = (v: FormDataEntryValue | null) => (v === null || v === "" ? undefined : v);
  return [...indices]
    .sort((a, b) => a - b)
    .map((i) => ({
      label: orNull(form.get(`tiers[${i}][label]`)),
      claimRule: form.get(`tiers[${i}][claimRule]`),
      minShiftMinutes: orNull(form.get(`tiers[${i}][minShiftMinutes]`)),
      leadHours: orNull(form.get(`tiers[${i}][leadHours]`)),
      respondentIds: form.getAll(`tiers[${i}][respondentIds]`).map(String),
    }));
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return appRedirect("/login");
  }

  const form = await request.formData();
  const parsed = createWindowSchema.safeParse({
    startsAtLocal: form.get("startsAtLocal"),
    endsAtLocal: form.get("endsAtLocal"),
    notes: form.get("notes") ?? "",
    // Filter + dedupe here rather than letting one stray tag reject the whole form.
    taskTags: [...new Set(form.getAll("taskTags").map(String).filter(isTaskTag))],
    tiers: parseTiers(form),
  });

  if (!parsed.success) {
    return appRedirect("/?error=window");
  }

  const data = parsed.data;
  try {
    await createWindow({
      startsAt: zonedWallTimeToUtc(data.startsAtLocal),
      endsAt: zonedWallTimeToUtc(data.endsAtLocal),
      notes: data.notes,
      taskTags: data.taskTags,
      tiers: data.tiers.map((t) => ({
        label: t.label,
        claimRule: t.claimRule,
        minShiftMinutes: t.minShiftMinutes,
        leadHours: t.leadHours,
        respondentIds: t.respondentIds,
      })),
    });
  } catch (error) {
    console.error("createWindow failed:", error);
    return appRedirect("/?error=window");
  }

  return appRedirect("/");
}
