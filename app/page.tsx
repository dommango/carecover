import Link from "next/link";
import { requireAdmin } from "@/lib/guard";
import { getAdminWindows, type WindowSummary } from "@/lib/admin";
import { formatDate, formatTime } from "@/lib/time";
import { CoverageBar } from "@/components/coverage-bar";
import { CalendarView } from "@/components/calendar-view";
import { AutoRefresh } from "@/components/auto-refresh";
import { AdminShell } from "@/components/admin-shell";
import { BtnLink, Note, StatusBadge, windowBadge } from "@/components/ui";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

// Day-of-week eyebrow, with "TODAY ·" prefix when the window starts today.
function dayEyebrow(d: Date): string {
  const dow = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  return sameDay ? `TODAY · ${dow}` : dow;
}

function coverageCaption(w: WindowSummary): string {
  const gapCount = w.gaps.length;
  if (gapCount === 0) return `${w.coveredPercent}% covered · all set`;
  const gapWord = gapCount === 1 ? "gap" : "gaps";
  return `${w.coveredPercent}% covered · ${gapCount} ${gapWord} open`;
}

function activeTier(w: WindowSummary) {
  return w.tiers.find((t) => t.position === w.activeTierIndex);
}

function deadlineMeta(w: WindowSummary): { label: string; value: string } {
  switch (w.status) {
    case "OPEN":
      return w.currentTierDeadlineAt
        ? { label: "Escalates", value: formatDate(w.currentTierDeadlineAt) }
        : { label: "Final tier", value: "Awaiting replies" };
    case "FILLED":
      return { label: "Status", value: "All set" };
    case "CLOSED":
      return { label: "Status", value: "Closed" };
    case "EXPIRED":
      return { label: "Status", value: "Expired" };
  }
}

function WindowRow({ w }: { w: WindowSummary }) {
  const badge = windowBadge(w.status, w.coveredPercent, w.flaggedGaps.length > 0, activeTier(w)?.label);
  const deadline = deadlineMeta(w);

  return (
    <Link
      href={`/windows/${w.id}`}
      className="cc-card cc-dash-row"
      style={{ textDecoration: "none", color: "inherit", padding: "18px 22px" }}
    >
      {/* WHEN */}
      <div>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: "var(--ink-faint)",
            letterSpacing: ".3px",
          }}
        >
          {dayEyebrow(w.startsAt)}
        </div>
        <div
          className="cc-serif"
          style={{ fontSize: 19, fontWeight: 500, lineHeight: 1.1, marginTop: 1 }}
        >
          {formatDate(w.startsAt)}
        </div>
        <div
          className="cc-row"
          style={{ gap: 5, marginTop: 3, fontSize: 13.5, fontWeight: 700, color: "var(--ink-soft)" }}
        >
          <Icon.clock width={14} height={14} style={{ color: "var(--accent)" }} />
          {formatTime(w.startsAt)} – {formatTime(w.endsAt)}
        </div>
      </div>

      {/* COVERAGE */}
      <div>
        <CoverageBar
          startsAt={w.startsAt}
          endsAt={w.endsAt}
          assignments={w.assignments}
          gaps={w.gaps}
          size="sm"
          ticks={false}
        />
        <div style={{ marginTop: 9, fontSize: 12.5, fontWeight: 700, color: "var(--ink-soft)" }}>
          {coverageCaption(w)}
        </div>
        {w.notes && (
          <div
            style={{
              marginTop: 4,
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--ink-faint)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {w.notes}
          </div>
        )}
        {w.flaggedGaps.length > 0 && (
          <div
            className="cc-row"
            style={{ gap: 6, marginTop: 6, fontSize: 12.5, fontWeight: 700, color: "var(--await-ink)" }}
          >
            <Icon.flag width={13} height={13} />
            {w.flaggedGaps.length === 1
              ? "1 gap too short to auto-offer"
              : `${w.flaggedGaps.length} gaps too short to auto-offer`}
          </div>
        )}
      </div>

      {/* STATUS */}
      <div>
        <StatusBadge kind={badge.kind} label={badge.label} />
      </div>

      {/* NEXT DEADLINE */}
      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink-soft)" }}>
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: "var(--ink-faint)",
            letterSpacing: ".3px",
            textTransform: "uppercase",
          }}
        >
          {deadline.label}
        </div>
        <div style={{ marginTop: 2 }}>{deadline.value}</div>
      </div>

      <Icon.chevR width={18} height={18} style={{ color: "var(--ink-faint)" }} />
    </Link>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; error?: string }>;
}) {
  await requireAdmin();
  const { view, error } = await searchParams;
  const showCalendar = view === "calendar";
  const windows = await getAdminWindows();

  const errorNote = error === "window" && (
    <div style={{ marginBottom: 18 }}>
      <Note tone="bad" icon={<Icon.x width={17} height={17} />}>
        Couldn&apos;t post that window — check the times and tiers, then try again.
      </Note>
    </div>
  );

  const sub =
    windows.length > 0
      ? `${windows.length} window${windows.length === 1 ? "" : "s"} · sorted by what needs you soonest`
      : undefined;

  const hasActive = windows.some((w) => w.status === "OPEN");

  const actions = (
    <div className="cc-row" style={{ gap: 10, flexWrap: "wrap" }}>
      <div className="cc-seg-toggle">
        <Link
          href="/"
          className={showCalendar ? "" : "is-on"}
          style={{ textDecoration: "none" }}
        >
          List
        </Link>
        <Link
          href="/?view=calendar"
          className={showCalendar ? "is-on" : ""}
          style={{ textDecoration: "none" }}
        >
          Calendar
        </Link>
      </div>
      <BtnLink href="/windows/new" icon={<Icon.plus />}>
        Post a window
      </BtnLink>
    </div>
  );

  if (windows.length === 0) {
    return (
      <AdminShell active="dash" title="Coverage" actions={actions}>
        {errorNote}
        <div
          style={{
            minHeight: "60vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ textAlign: "center", maxWidth: 440 }}>
            <div
              style={{
                width: 92,
                height: 92,
                borderRadius: "50%",
                background: "var(--accent-tint)",
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 24px",
              }}
            >
              <Icon.cal width={40} height={40} />
            </div>
            <h2 className="cc-serif" style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-.3px" }}>
              Nothing needs coverage right now
            </h2>
            <p
              style={{
                fontSize: 16,
                color: "var(--ink-soft)",
                fontWeight: 600,
                marginTop: 10,
                lineHeight: 1.5,
                textWrap: "pretty",
              }}
            >
              When a time comes up that someone is needed, post it here. We&apos;ll text the family a
              simple link — and reach trusted caregivers if a gap is left.
            </p>
            <div style={{ marginTop: 24, display: "inline-flex" }}>
              <BtnLink href="/windows/new" variant="primary" size="xl" icon={<Icon.plus />}>
                Post your first window
              </BtnLink>
            </div>
          </div>
        </div>
      </AdminShell>
    );
  }

  const needsYou = windows.filter((w) => w.flaggedGaps.length > 0).length;
  const openGaps = windows.filter((w) => w.gaps.length > 0).length;
  const allSet = windows.filter((w) => w.coveredPercent >= 100).length;

  const stats: { n: number; l: string; tone: "attention" | "await" | "calm" }[] = [
    { n: needsYou, l: needsYou === 1 ? "window needs you" : "windows need you", tone: "attention" },
    { n: openGaps, l: openGaps === 1 ? "window with a gap" : "windows with gaps", tone: "await" },
    { n: allSet, l: allSet === 1 ? "window fully covered" : "windows fully covered", tone: "calm" },
  ];

  return (
    <AdminShell active="dash" title="Coverage" sub={sub} actions={actions}>
      {errorNote}
      {/* summary strip */}
      <div className="cc-dash-stats" style={{ marginBottom: 18 }}>
        {stats.map((s, i) => (
          <div
            key={i}
            className="cc-card"
            style={{ padding: "15px 20px", display: "flex", alignItems: "center", gap: 14 }}
          >
            <div
              style={{
                fontSize: 34,
                fontWeight: 800,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                color:
                  s.tone === "attention"
                    ? "var(--accent)"
                    : s.tone === "await"
                      ? "var(--await-ink)"
                      : "var(--ink)",
              }}
            >
              {s.n}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-soft)", lineHeight: 1.25 }}>
              {s.l}
            </div>
          </div>
        ))}
      </div>

      {/* column header (desktop) */}
      <div className="cc-dash-head">
        {["WHEN", "COVERAGE", "STATUS", "NEXT DEADLINE", ""].map((h, i) => (
          <div key={i} className="cc-eyebrow" style={{ fontSize: 11 }}>
            {h}
          </div>
        ))}
      </div>

      {hasActive && <AutoRefresh seconds={60} />}

      {showCalendar ? (
        <CalendarView windows={windows} />
      ) : (
        <>
          {/* column header (desktop) */}
          <div className="cc-dash-head">
            {["WHEN", "COVERAGE", "STATUS", "NEXT DEADLINE", ""].map((h, i) => (
              <div key={i} className="cc-eyebrow" style={{ fontSize: 11 }}>
                {h}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {windows.map((w) => (
              <WindowRow key={w.id} w={w} />
            ))}
          </div>
        </>
      )}
    </AdminShell>
  );
}
