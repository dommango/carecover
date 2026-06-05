import { minutes, type Interval } from "@/lib/coverage";
import { formatTime } from "@/lib/time";

interface AssignmentLike {
  startsAt: Date;
  endsAt: Date;
  respondentName: string;
  tier: "TIER1" | "TIER2";
}

interface Segment {
  start: Date;
  end: Date;
  kind: "covered" | "gap";
  label: string;
}

// A proportional timeline of a window: green where covered (by whom), amber where open.
export function CoverageBar({
  startsAt,
  endsAt,
  assignments,
  gaps,
}: {
  startsAt: Date;
  endsAt: Date;
  assignments: AssignmentLike[];
  gaps: Interval[];
}) {
  const total = minutes({ start: startsAt, end: endsAt }) || 1;

  const segments: Segment[] = [
    ...assignments.map((a) => ({
      start: a.startsAt,
      end: a.endsAt,
      kind: "covered" as const,
      label: `${a.respondentName}: ${formatTime(a.startsAt)}–${formatTime(a.endsAt)}`,
    })),
    ...gaps.map((g) => ({
      start: g.start,
      end: g.end,
      kind: "gap" as const,
      label: `Open: ${formatTime(g.start)}–${formatTime(g.end)}`,
    })),
  ].sort((a, b) => a.start.getTime() - b.start.getTime());

  return (
    <div
      className="flex h-6 w-full overflow-hidden rounded-md border border-black/10"
      role="img"
      aria-label="Coverage timeline"
    >
      {segments.map((s, i) => (
        <div
          key={i}
          title={s.label}
          style={{ width: `${(minutes(s) / total) * 100}%` }}
          className={
            s.kind === "covered"
              ? "h-full bg-emerald-500/80 text-[10px] text-white truncate px-1 leading-6"
              : "h-full bg-amber-400/70 text-[10px] text-amber-950 truncate px-1 leading-6"
          }
        >
          {s.kind === "covered" ? s.label.split(":")[0] : "open"}
        </div>
      ))}
    </div>
  );
}
