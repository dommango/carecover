import Link from "next/link";
import type { WindowSummary } from "@/lib/admin";
import { formatTime } from "@/lib/time";
import { CoverageBar } from "@/components/coverage-bar";
import { StatusBadge, windowBadge } from "@/components/ui";

const STATUS_BG: Record<string, string> = {
  OPEN_TIER1: "var(--accent-tint)",
  ESCALATED_TIER2: "var(--caregiver-tint)",
  FILLED: "var(--covered-tint)",
  CLOSED: "var(--gap-tint)",
  EXPIRED: "var(--gap-tint)",
};

const STATUS_BORDER: Record<string, string> = {
  OPEN_TIER1: "var(--accent)",
  ESCALATED_TIER2: "var(--caregiver)",
  FILLED: "var(--covered)",
  CLOSED: "var(--gap)",
  EXPIRED: "var(--gap)",
};

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(d: Date): string {
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (isToday) return "Today";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export function CalendarView({ windows }: { windows: WindowSummary[] }) {
  // Group by start date, sorted chronologically
  const groups = new Map<string, { date: Date; windows: WindowSummary[] }>();
  for (const w of windows) {
    const key = dayKey(w.startsAt);
    if (!groups.has(key)) {
      groups.set(key, { date: w.startsAt, windows: [] });
    }
    groups.get(key)!.windows.push(w);
  }
  const sorted = Array.from(groups.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

  if (sorted.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--ink-faint)", fontWeight: 600 }}>
        No windows to show.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {sorted.map((g) => (
        <div key={dayKey(g.date)}>
          <div className="cc-eyebrow" style={{ marginBottom: 12, fontSize: 13 }}>
            {dayLabel(g.date)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {g.windows.map((w) => {
              const badge = windowBadge(w.status, w.coveredPercent, w.flaggedGaps.length > 0);
              return (
                <Link
                  key={w.id}
                  href={`/windows/${w.id}`}
                  className="cc-card"
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    padding: "18px 22px",
                    borderLeft: `4px solid ${STATUS_BORDER[w.status] ?? "var(--line)"}`,
                    background: STATUS_BG[w.status] ?? "var(--card)",
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 14,
                    alignItems: "start",
                  }}
                >
                  <div>
                    <div className="cc-row" style={{ gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                      <StatusBadge kind={badge.kind} label={badge.label} />
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink-soft)" }}>
                        {formatTime(w.startsAt)} – {formatTime(w.endsAt)}
                      </span>
                    </div>
                    <CoverageBar
                      startsAt={w.startsAt}
                      endsAt={w.endsAt}
                      assignments={w.assignments}
                      gaps={w.gaps}
                      size="sm"
                      ticks={false}
                    />
                    {w.notes && (
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--ink-soft)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {w.notes}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 800,
                      color: "var(--ink)",
                      lineHeight: 1,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {w.coveredPercent}%
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
