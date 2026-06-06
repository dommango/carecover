import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/guard";
import { getWindowDetail } from "@/lib/admin";
import { listRespondents } from "@/lib/respondents";
import { formatDate, formatRange, formatTime, toLocalInputValue } from "@/lib/time";
import { CoverageBar } from "@/components/coverage-bar";
import { AdminShell } from "@/components/admin-shell";
import { Icon } from "@/components/icons";
import {
  Btn,
  StatusBadge,
  windowBadge,
  Avatar,
  CovLegend,
  Note,
} from "@/components/ui";

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

  const badge = windowBadge(w.status, w.coveredPercent, w.flaggedGaps.length > 0);
  const deadlineUpcoming = w.status === "OPEN_TIER1";
  const isFlagged = (g: { start: Date; end: Date }) =>
    w.flaggedGaps.some(
      (f) => f.start.getTime() === g.start.getTime() && f.end.getTime() === g.end.getTime(),
    );

  return (
    <AdminShell
      active="dash"
      title={formatRange(w.startsAt, w.endsAt)}
      sub={`${formatDate(w.startsAt)} · ${w.coveredPercent}% covered`}
      actions={
        active ? (
          <>
            <form method="post" action={`/api/windows/${w.id}/resend`}>
              <Btn variant="secondary" icon={<Icon.send width={18} height={18} />}>
                Resend text
              </Btn>
            </form>
            <form method="post" action={`/api/windows/${w.id}/close`}>
              <Btn variant="primary">Close window</Btn>
            </form>
          </>
        ) : undefined
      }
    >
      {(ok === "assigned" || resent || error) && (
        <div style={{ marginBottom: 18 }}>
          {ok === "assigned" && (
            <Note tone="good" icon={<Icon.check width={17} height={17} />}>
              Assignment added.
            </Note>
          )}
          {resent && (
            <Note tone="good" icon={<Icon.send width={17} height={17} />}>
              Reminder texts sent.
            </Note>
          )}
          {error && (
            <Note tone="bad" icon={<Icon.x width={17} height={17} />}>
              That time isn&apos;t available.
            </Note>
          )}
        </div>
      )}

      {w.notes && (
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--ink-soft)",
            lineHeight: 1.45,
            marginBottom: 18,
          }}
        >
          {w.notes}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 360px)",
          gap: 26,
          alignItems: "start",
        }}
        className="cc-detail-grid"
      >
        {/* left: timeline + flag + manual assign */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          <div className="cc-card" style={{ padding: 24 }}>
            <div
              className="cc-row"
              style={{ justifyContent: "space-between", marginBottom: 18, gap: 12, flexWrap: "wrap" }}
            >
              <StatusBadge kind={badge.kind} label={badge.label} />
              {deadlineUpcoming ? (
                <span
                  className="cc-row"
                  style={{ gap: 6, fontSize: 13.5, fontWeight: 700, color: "var(--ink-soft)" }}
                >
                  <Icon.clock width={15} height={15} style={{ color: "var(--accent)" }} />
                  Caregivers at {formatTime(w.tier1DeadlineAt)}, {formatDate(w.tier1DeadlineAt)}
                </span>
              ) : (
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink-faint)" }}>
                  Deadline passed {formatDate(w.tier1DeadlineAt)}
                </span>
              )}
            </div>

            <CoverageBar
              startsAt={w.startsAt}
              endsAt={w.endsAt}
              assignments={w.assignments}
              gaps={w.gaps}
              size="lg"
              ticks
              tickStepHours={2}
            />

            <div style={{ marginTop: 16 }}>
              <CovLegend
                items={[
                  { kind: "family", label: "Family" },
                  { kind: "caregiver", label: "Caregiver" },
                  { kind: "gap", label: "Still open" },
                ]}
              />
            </div>
          </div>

          {/* gap-too-short flag — calm, not alarming */}
          {w.flaggedGaps.length > 0 && (
            <div
              className="cc-card"
              style={{ padding: 0, overflow: "hidden", border: "1px solid var(--await-tint)" }}
            >
              <div
                style={{
                  background: "var(--await-tint)",
                  padding: "14px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                }}
              >
                <span style={{ color: "var(--await-ink)" }}>
                  <Icon.flag width={18} height={18} />
                </span>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: "var(--await-ink)" }}>
                  {w.flaggedGaps.length === 1
                    ? "One gap is too short to auto-offer"
                    : `${w.flaggedGaps.length} gaps are too short to auto-offer`}
                </div>
              </div>
              <div style={{ padding: "16px 20px" }}>
                <div
                  style={{
                    fontSize: 14.5,
                    fontWeight: 600,
                    color: "var(--ink-soft)",
                    lineHeight: 1.45,
                    marginBottom: 14,
                  }}
                >
                  <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                    {w.flaggedGaps.map((g, i) => (
                      <li key={i}>
                        <b style={{ color: "var(--ink)" }}>
                          {formatTime(g.start)} – {formatTime(g.end)}
                        </b>
                      </li>
                    ))}
                  </ul>
                  <div style={{ marginTop: 10 }}>
                    Your caregivers need a longer minimum shift, so we won&apos;t text them
                    automatically — these are yours to handle by hand.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* manual assign */}
          {active && (
            <div className="cc-card" style={{ padding: 24 }}>
              <div className="cc-eyebrow" style={{ marginBottom: 16 }}>
                Assign by hand
              </div>
              <form
                method="post"
                action={`/api/windows/${w.id}/assign`}
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div>
                  <div className="cc-field-label" style={{ marginBottom: 6 }}>
                    PERSON
                  </div>
                  <select name="respondentId" className="cc-input">
                    {respondents.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.tier === "TIER1" ? "family" : "caregiver"})
                      </option>
                    ))}
                  </select>
                </div>
                <div
                  style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
                  className="cc-assign-times"
                >
                  <div>
                    <div className="cc-field-label" style={{ marginBottom: 6 }}>
                      FROM
                    </div>
                    <input
                      type="datetime-local"
                      name="startsAtLocal"
                      min={windowMin}
                      max={windowMax}
                      step={900}
                      defaultValue={toLocalInputValue(assignFrom)}
                      className="cc-input"
                    />
                  </div>
                  <div>
                    <div className="cc-field-label" style={{ marginBottom: 6 }}>
                      TO
                    </div>
                    <input
                      type="datetime-local"
                      name="endsAtLocal"
                      min={windowMin}
                      max={windowMax}
                      step={900}
                      defaultValue={toLocalInputValue(assignTo)}
                      className="cc-input"
                    />
                  </div>
                </div>
                <div>
                  <Btn variant="primary" size="sm" icon={<Icon.users width={16} height={16} />}>
                    Assign by hand
                  </Btn>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* right: who's covering + open gaps */}
        <div className="cc-card" style={{ padding: 22, display: "flex", flexDirection: "column" }}>
          <div className="cc-eyebrow" style={{ marginBottom: 4 }}>
            Who&apos;s covering
          </div>
          {w.assignments.length === 0 ? (
            <Note tone="calm" icon={<Icon.bell width={17} height={17} />} style={{ marginTop: 12 }}>
              No one yet — the family has been texted a link to claim time.
            </Note>
          ) : (
            <div style={{ marginTop: 6 }}>
              {w.assignments.map((a, i) => (
                <div key={a.id}>
                  {i > 0 && <hr className="cc-divider" />}
                  <div
                    className="cc-row"
                    style={{ justifyContent: "space-between", padding: "11px 0", gap: 10 }}
                  >
                    <div className="cc-row" style={{ gap: 11, minWidth: 0 }}>
                      <Avatar name={a.respondentName} tier={a.tier} />
                      <div style={{ lineHeight: 1.2, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {a.respondentName}
                        </div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-faint)" }}>
                          {a.tier === "TIER1" ? "Family" : "Paid caregiver"}
                        </div>
                      </div>
                    </div>
                    <span
                      className="cc-row"
                      style={{
                        gap: 4,
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--covered-ink)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Icon.check width={14} height={14} />
                      {formatTime(a.startsAt)}–{formatTime(a.endsAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {w.gaps.length > 0 && (
            <>
              <div className="cc-eyebrow" style={{ margin: "20px 0 4px" }}>
                Still open
              </div>
              <div style={{ marginTop: 6 }}>
                {w.gaps.map((g, i) => (
                  <div key={i}>
                    {i > 0 && <hr className="cc-divider" />}
                    <div
                      className="cc-row"
                      style={{ justifyContent: "space-between", padding: "11px 0", gap: 10 }}
                    >
                      <span
                        className="cc-row"
                        style={{ gap: 8, fontSize: 14, fontWeight: 700, color: "var(--ink-soft)" }}
                      >
                        <span
                          className="cc-legend-sw"
                          style={{
                            background: "var(--gap-tint)",
                            boxShadow: "inset 0 0 0 1px rgba(120,108,90,.2)",
                          }}
                        />
                        {formatTime(g.start)}–{formatTime(g.end)}
                      </span>
                      {isFlagged(g) && (
                        <span
                          className="cc-row"
                          style={{
                            gap: 4,
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: "var(--await-ink)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <Icon.flag width={13} height={13} />
                          Too short to auto-offer
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
