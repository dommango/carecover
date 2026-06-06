import { type Interval } from "@/lib/coverage";
import { formatTime } from "@/lib/time";
import { tierKind } from "@/components/ui";

// The central metaphor: a proportional timeline of a window. Covered blocks
// (family = terracotta, caregiver = slate, "you" = sage) sit over a hatched
// gray track that shows through as the remaining gaps. Warm design system.

interface AssignmentLike {
  startsAt: Date;
  endsAt: Date;
  respondentName: string;
  tier: "TIER1" | "TIER2";
}

type CovKind = "family" | "caregiver" | "covered" | "await" | "gap";

export interface CovSegment {
  start: Date;
  end: Date;
  kind: CovKind;
  label?: string;
  sub?: string;
}

function firstName(name: string): string {
  return name.split(/\s+/)[0] || name;
}

// "8:00 AM" -> "8a", "1:30 PM" -> "1:30p"
function shortTick(d: Date): string {
  return formatTime(d)
    .replace(":00", "")
    .replace(" AM", "a")
    .replace(" PM", "p");
}

export function CoverageBar({
  startsAt,
  endsAt,
  assignments = [],
  gaps = [],
  segments,
  size = "md",
  ticks = false,
  tickStepHours = 2,
}: {
  startsAt: Date;
  endsAt: Date;
  assignments?: AssignmentLike[];
  gaps?: Interval[];
  segments?: CovSegment[];
  size?: "sm" | "md" | "lg";
  ticks?: boolean;
  tickStepHours?: number;
}) {
  const span = Math.max(endsAt.getTime() - startsAt.getTime(), 1);
  const pct = (d: Date) => `${((d.getTime() - startsAt.getTime()) / span) * 100}%`;
  const width = (a: Date, b: Date) => `${((b.getTime() - a.getTime()) / span) * 100}%`;

  const segs: CovSegment[] =
    segments ??
    [
      ...assignments.map((a) => ({
        start: a.startsAt,
        end: a.endsAt,
        kind: tierKind(a.tier),
        label: firstName(a.respondentName),
      })),
      ...gaps.map((g) => ({
        start: g.start,
        end: g.end,
        kind: "gap" as const,
        label: size === "sm" ? undefined : "Open",
      })),
    ].sort((a, b) => a.start.getTime() - b.start.getTime());

  // tick marks
  const tickEls: { left: string; label: string }[] = [];
  if (ticks) {
    const stepMs = tickStepHours * 3_600_000;
    const firstTick = new Date(Math.ceil(startsAt.getTime() / stepMs) * stepMs);
    const marks: Date[] = [];
    for (let t = firstTick.getTime(); t <= endsAt.getTime() + 1; t += stepMs) marks.push(new Date(t));
    if (marks.length === 0 || marks[0].getTime() > startsAt.getTime() + 1) marks.unshift(startsAt);
    if (marks[marks.length - 1].getTime() < endsAt.getTime() - 1) marks.push(endsAt);
    marks.forEach((m) => tickEls.push({ left: pct(m), label: shortTick(m) }));
  }

  return (
    <div className="cc-cov">
      <div
        className={`cc-cov-track cc-cov-track--${size}`}
        role="img"
        aria-label="Coverage timeline"
      >
        {segs.map((s, i) => {
          const frac = (s.end.getTime() - s.start.getTime()) / span;
          const wide = frac > 0.16;
          const veryWide = frac > 0.28;
          return (
            <div
              key={i}
              className={`cc-seg cc-seg--${s.kind}`}
              style={{ left: pct(s.start), width: width(s.start, s.end) }}
              title={s.label ? `${s.label}${s.sub ? ` · ${s.sub}` : ""}` : undefined}
            >
              {s.label && wide && (
                <div style={{ textAlign: "center", lineHeight: 1.15 }}>
                  <div className="cc-seg-label">{s.label}</div>
                  {s.sub && veryWide && <div className="cc-seg-sub">{s.sub}</div>}
                </div>
              )}
              {s.label && !wide && s.kind !== "gap" && (
                <div className="cc-seg-label" style={{ fontSize: 11 }}>
                  {s.label[0]}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {ticks && (
        <div className="cc-cov-ticks">
          {tickEls.map((t, i) => {
            const edgeL = i === 0;
            const edgeR = i === tickEls.length - 1;
            return (
              <span
                key={i}
                className={`cc-tick${edgeL ? " cc-tick--edge-l" : ""}${edgeR ? " cc-tick--edge-r" : ""}`}
                style={{ left: t.left }}
              >
                {t.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
