import { getResponseView } from "@/lib/windows";
import { formatRange, formatTime, formatDate, toLocalInputValue } from "@/lib/time";
import { Btn, Note, durLabel } from "@/components/ui";
import { CoverageBar, type CovSegment } from "@/components/coverage-bar";
import { CovLegend } from "@/components/ui";
import { Icon } from "@/components/icons";
import { PresetButtons } from "@/components/preset-buttons";
import { UnclaimForm } from "@/components/unclaim-form";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

const COLUMN: React.CSSProperties = {
  maxWidth: 430,
  margin: "0 auto",
  width: "100%",
  minHeight: "100dvh",
  padding: "28px 22px 36px",
  background: "var(--sand)",
  display: "flex",
  flexDirection: "column",
};

/* A large round status seal — colored circle, white centered icon. */
function BigSeal({ tone, icon }: { tone: "covered" | "gap"; icon: ReactNode }) {
  const bg = tone === "covered" ? "var(--covered)" : "var(--gap)";
  const shadow =
    tone === "covered" ? "0 10px 28px rgba(122,160,107,.4)" : "0 10px 28px rgba(120,108,90,.28)";
  return (
    <div
      style={{
        width: 88,
        height: 88,
        borderRadius: "50%",
        background: bg,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto 22px",
        boxShadow: shadow,
      }}
    >
      {icon}
    </div>
  );
}

function SealState({
  tone,
  icon,
  title,
  body,
  footer,
}: {
  tone: "covered" | "gap";
  icon: ReactNode;
  title: string;
  body: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="cc" style={COLUMN}>
      <div style={{ marginTop: 34 }}>
        <BigSeal tone={tone} icon={icon} />
        <div
          className="cc-serif"
          style={{
            fontSize: 29,
            fontWeight: 500,
            textAlign: "center",
            lineHeight: 1.15,
            letterSpacing: "-.3px",
            color: "var(--ink)",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 16.5,
            color: "var(--ink-soft)",
            fontWeight: 600,
            textAlign: "center",
            marginTop: 10,
            textWrap: "pretty",
          }}
        >
          {body}
        </div>
      </div>
      {footer && <div style={{ marginTop: 24 }}>{footer}</div>}
    </main>
  );
}

function firstNameOf(name: string): string {
  return name.split(/\s+/)[0] || name;
}

/** Subtract gaps from [startsAt,endsAt] to derive the covered ("Taken") pieces. */
function coverageSegments(
  startsAt: Date,
  endsAt: Date,
  gaps: { start: Date; end: Date }[],
): CovSegment[] {
  const sorted = [...gaps].sort((a, b) => a.start.getTime() - b.start.getTime());
  const segs: CovSegment[] = [];
  let cursor = startsAt.getTime();
  for (const g of sorted) {
    if (g.start.getTime() > cursor) {
      segs.push({
        start: new Date(cursor),
        end: new Date(g.start.getTime()),
        kind: "covered",
        label: "Taken",
      });
    }
    segs.push({ start: g.start, end: g.end, kind: "gap", label: "Open" });
    cursor = Math.max(cursor, g.end.getTime());
  }
  if (cursor < endsAt.getTime()) {
    segs.push({ start: new Date(cursor), end: endsAt, kind: "covered", label: "Taken" });
  }
  return segs;
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
      <SealState
        tone="gap"
        icon={<Icon.x width={42} height={42} />}
        title="This link isn't valid"
        body="Please ask whoever sent it for a fresh link."
      />
    );
  }

  const firstName = firstNameOf(view.respondentName);
  const closed =
    view.expired || view.fullyCovered || view.status === "FILLED" || view.status === "CLOSED";
  const wholeGapOnly = view.claimRule === "WHOLE_GAP";

  /* ---------- end states (gentle seals) ---------- */
  if (status === "claimed") {
    return (
      <SealState
        tone="covered"
        icon={<Icon.check width={44} height={44} />}
        title={`Thank you, ${firstName}.`}
        body="You're all set — your time is locked in."
        footer={
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <a
              href={`/api/respond/${token}/calendar`}
              download
              className="cc-btn cc-btn--secondary cc-btn--block"
              style={{ textDecoration: "none" }}
            >
              <Icon.cal />
              Add to calendar
            </a>
            {view.hasAssignment && <UnclaimForm token={token} />}
            {!view.fullyCovered ? (
              <Note tone="calm" icon={<Icon.bell />}>
                Other times may still need help. We&apos;ll text you if so.
              </Note>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  fontSize: 14,
                  color: "var(--ink-faint)",
                  fontWeight: 600,
                }}
              >
                You can close this page.
              </div>
            )}
          </div>
        }
      />
    );
  }

  if (status === "declined") {
    return (
      <SealState
        tone="gap"
        icon={<Icon.check width={42} height={42} />}
        title="Thanks for letting us know."
        body="No worries at all — we&apos;ll find someone else."
      />
    );
  }

  if (status === "unclaimed") {
    return (
      <SealState
        tone="gap"
        icon={<Icon.clock width={42} height={42} />}
        title="We've let the coordinator know."
        body="Your time is now open for someone else to claim."
      />
    );
  }

  if (status === "unclaim-error") {
    return (
      <SealState
        tone="gap"
        icon={<Icon.x width={42} height={42} />}
        title="Couldn't cancel"
        body="No active assignment was found. It may have already been removed."
      />
    );
  }

  if (closed) {
    if (view.expired) {
      return (
        <SealState
          tone="gap"
          icon={<Icon.clock width={42} height={42} />}
          title="This window has passed"
          body={
            <>
              The time for{" "}
              <b style={{ color: "var(--ink)" }}>{formatDate(view.startsAt)}</b> is no longer open
              to claim.
            </>
          }
        />
      );
    }
    if (view.fullyCovered || view.status === "FILLED") {
      return (
        <SealState
          tone="covered"
          icon={<Icon.heart width={40} height={40} />}
          title="All covered — thank you!"
          body="This time is fully taken care of. No action needed from you."
        />
      );
    }
    // CLOSED
    return (
      <SealState
        tone="gap"
        icon={<Icon.clock width={42} height={42} />}
        title="This window is closed."
        body="There's nothing needed here right now."
      />
    );
  }

  /* ---------- active claim page ---------- */
  const sub = wholeGapOnly
    ? "There's an open shift you can take. Here's what's available."
    : "Someone's needed for this time. Can you take part of it?";

  const covSegs = coverageSegments(view.startsAt, view.endsAt, view.gaps);

  return (
    <main className="cc" style={COLUMN}>
      {/* Greeting */}
      <div style={{ marginBottom: 16 }}>
        <div
          className="cc-serif"
          style={{
            fontSize: 27,
            fontWeight: 500,
            color: "var(--ink)",
            letterSpacing: "-.2px",
          }}
        >
          Hi {firstName},
        </div>
        <div
          style={{ fontSize: 16, color: "var(--ink-soft)", fontWeight: 600, marginTop: 3 }}
        >
          {sub}
        </div>
      </div>

      {/* Window card */}
      <div className="cc-card" style={{ padding: 18, marginBottom: 16 }}>
        <div className="cc-row" style={{ gap: 12, marginBottom: covSegs.length ? 14 : 0 }}>
          <div
            style={{
              flex: "0 0 auto",
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "var(--accent-tint)",
              color: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon.clock width={22} height={22} />
          </div>
          <div>
            <div
              className="cc-serif"
              style={{ fontSize: 21, fontWeight: 500, lineHeight: 1.15 }}
            >
              {formatDate(view.startsAt)}
            </div>
            <div
              style={{
                fontSize: 15.5,
                fontWeight: 700,
                color: "var(--ink-soft)",
                marginTop: 2,
              }}
            >
              {formatRange(view.startsAt, view.endsAt)}
            </div>
          </div>
        </div>

        {view.notes && (
          <div
            style={{
              fontSize: 15,
              color: "var(--ink-soft)",
              fontWeight: 600,
              marginBottom: 14,
              textWrap: "pretty",
            }}
          >
            {view.notes}
          </div>
        )}

        <CoverageBar
          startsAt={view.startsAt}
          endsAt={view.endsAt}
          segments={covSegs}
          size="lg"
          ticks
        />
        <div style={{ marginTop: 14 }}>
          <CovLegend
            items={[
              { kind: "covered", label: "Already covered" },
              { kind: "gap", label: "Still open" },
            ]}
          />
        </div>
      </div>

      {/* conflict / invalid notices above the forms */}
      {status === "conflict" && (
        <div style={{ marginBottom: 14 }}>
          <Note tone="bad">
            Sorry — someone just grabbed that time. Here&apos;s what&apos;s still open.
          </Note>
        </div>
      )}
      {status === "invalid" && (
        <div style={{ marginBottom: 14 }}>
          <Note tone="bad">That didn&apos;t look right. Please try again.</Note>
        </div>
      )}

      {/* claim controls */}
      {view.actionableGaps.length === 0 ? (
        <Note tone="calm" icon={<Icon.check />}>
          {wholeGapOnly
            ? "No open block currently matches the minimum shift."
            : "Everything is currently covered."}
        </Note>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {view.actionableGaps.map((gap, i) => {
            const mins = (gap.end.getTime() - gap.start.getTime()) / 60000;
            return wholeGapOnly ? (
              <form
                key={i}
                method="post"
                action={`/api/respond/${token}`}
                className="cc-card"
                style={{ padding: 18 }}
              >
                <input type="hidden" name="action" value="claim" />
                <input type="hidden" name="startsAtLocal" value={toLocalInputValue(gap.start)} />
                <input type="hidden" name="endsAtLocal" value={toLocalInputValue(gap.end)} />
                <div
                  className="cc-row"
                  style={{ justifyContent: "space-between", marginBottom: 12 }}
                >
                  <div>
                    <div className="cc-field-label">OPEN SHIFT</div>
                    <div
                      className="cc-serif"
                      style={{ fontSize: 22, fontWeight: 500, marginTop: 2 }}
                    >
                      {formatTime(gap.start)} – {formatTime(gap.end)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 800,
                        color: "var(--accent-deep)",
                        lineHeight: 1,
                      }}
                    >
                      {durLabel(mins)}
                    </div>
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <Note tone="calm" icon={<Icon.clock />}>
                    This shift is all-or-nothing — you&apos;d take the full block.
                  </Note>
                </div>
                <Btn variant="primary" size="xl" block icon={<Icon.check />}>
                  Accept this shift
                </Btn>
              </form>
            ) : (
              <form
                key={i}
                method="post"
                action={`/api/respond/${token}`}
                className="cc-card"
                style={{ padding: 18 }}
              >
                <input type="hidden" name="action" value="claim" />
                <div className="cc-field-label" style={{ marginBottom: 12 }}>
                  Open: {formatTime(gap.start)} – {formatTime(gap.end)} · pick the part you can
                  cover
                </div>
                <PresetButtons index={i} gapStart={gap.start} gapEnd={gap.end} />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span className="cc-field-label">From</span>
                    <input
                      id={`gap-${i}-start`}
                      type="datetime-local"
                      name="startsAtLocal"
                      min={toLocalInputValue(gap.start)}
                      max={toLocalInputValue(gap.end)}
                      step={900}
                      defaultValue={toLocalInputValue(gap.start)}
                      required
                      className="cc-input"
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span className="cc-field-label">To</span>
                    <input
                      id={`gap-${i}-end`}
                      type="datetime-local"
                      name="endsAtLocal"
                      min={toLocalInputValue(gap.start)}
                      max={toLocalInputValue(gap.end)}
                      step={900}
                      defaultValue={toLocalInputValue(gap.end)}
                      required
                      className="cc-input"
                    />
                  </label>
                </div>
                <Btn variant="primary" size="xl" block icon={<Icon.check />}>
                  Accept this time
                </Btn>
              </form>
            );
          })}
        </div>
      )}

      {/* decline — always available */}
      <form
        method="post"
        action={`/api/respond/${token}`}
        style={{ marginTop: 14 }}
      >
        <input type="hidden" name="action" value="decline" />
        <Btn variant="ghost" block>
          I can&apos;t this time
        </Btn>
      </form>
    </main>
  );
}
