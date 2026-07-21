import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/guard";
import { getWindowDetail, getWindowNotifications } from "@/lib/admin";
import { listRespondents } from "@/lib/respondents";
import { formatDate, formatRange, formatTime, toLocalInputValue } from "@/lib/time";
import { CoverageBar } from "@/components/coverage-bar";
import { AutoRefresh } from "@/components/auto-refresh";
import { AdminShell } from "@/components/admin-shell";
import { ConfirmBtn } from "@/components/confirm-submit";
import { Icon } from "@/components/icons";
import {
  Btn,
  BtnLink,
  StatusBadge,
  windowBadge,
  Avatar,
  TierLabel,
  durLabel,
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

  const notifications = await getWindowNotifications(id);
  const respondents = (await listRespondents()).filter((r) => r.active);
  const active = w.status === "OPEN";
  const activeTier = w.tiers.find((t) => t.position === w.activeTierIndex);
  const assignFrom = w.gaps[0]?.start ?? w.startsAt;
  const assignTo = w.gaps[0]?.end ?? w.endsAt;
  const windowMin = toLocalInputValue(w.startsAt);
  const windowMax = toLocalInputValue(w.endsAt);

  const badge = windowBadge(w.status, w.coveredPercent, w.flaggedGaps.length > 0, activeTier?.label);
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
        <>
          <BtnLink
            href={`/windows/new?duplicate=${w.id}`}
            variant="secondary"
            icon={<Icon.plus width={18} height={18} />}
          >
            Duplicate
          </BtnLink>
          {active && (
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
          )}
        </>
      }
    >
      {active && <AutoRefresh seconds={60} />}
      {(ok === "assigned" || ok === "unassigned" || ok === "edited" || resent || error) && (
        <div style={{ marginBottom: 18 }}>
          {ok === "assigned" && (
            <Note tone="good" icon={<Icon.check width={17} height={17} />}>
              Assignment added.
            </Note>
          )}
          {ok === "unassigned" && (
            <Note tone="good" icon={<Icon.check width={17} height={17} />}>
              Assignment removed.
            </Note>
          )}
          {ok === "edited" && (
            <Note tone="good" icon={<Icon.check width={17} height={17} />}>
              Window updated.
            </Note>
          )}
          {resent && (
            <Note tone="good" icon={<Icon.send width={17} height={17} />}>
              Reminder texts sent.
            </Note>
          )}
          {error && (
            <Note tone="bad" icon={<Icon.x width={17} height={17} />}>
              {error === "edit"
                ? "Could not update window."
                : "That time isn\'t available."}
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
        {/* left: timeline + flag + manual assign + edit */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
          <div className="cc-card" style={{ padding: 24 }}>
            <div
              className="cc-row"
              style={{ justifyContent: "space-between", marginBottom: 18, gap: 12, flexWrap: "wrap" }}
            >
              <StatusBadge kind={badge.kind} label={badge.label} />
              {active && w.currentTierDeadlineAt ? (
                <span
                  className="cc-row"
                  style={{ gap: 6, fontSize: 13.5, fontWeight: 700, color: "var(--ink-soft)" }}
                >
                  <Icon.clock width={15} height={15} style={{ color: "var(--accent)" }} />
                  Next tier at {formatTime(w.currentTierDeadlineAt)}, {formatDate(w.currentTierDeadlineAt)}
                </span>
              ) : active ? (
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink-faint)" }}>
                  Final tier — awaiting replies
                </span>
              ) : null}
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

            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="cc-eyebrow">Escalation ladder</div>
              {w.tiers.map((t) => (
                <div
                  key={t.id}
                  className="cc-row"
                  style={{
                    justifyContent: "space-between",
                    gap: 10,
                    opacity: !active || t.active || t.position < w.activeTierIndex ? 1 : 0.55,
                  }}
                >
                  <div className="cc-row" style={{ gap: 10, minWidth: 0 }}>
                    <TierLabel position={t.position} label={t.label} />
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-faint)" }}>
                      {t.claimRule === "PARTIAL" ? "any part" : `whole gaps ≥ ${durLabel(t.minShiftMinutes)}`}
                      {t.memberCount > 0 ? ` · ${t.memberCount}` : " · nobody"}
                    </span>
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
                    {t.active ? "active now" : t.deadlineAt ? `→ ${formatTime(t.deadlineAt)}` : "last resort"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* gap-too-short flag */}
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

          {/* edit window (zero claims only) */}
          {active && w.assignments.length === 0 && (
            <div className="cc-card" style={{ padding: 24 }}>
              <div className="cc-eyebrow" style={{ marginBottom: 16 }}>
                Edit window
              </div>
              <form
                method="post"
                action={`/api/windows/${w.id}/edit`}
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div
                  style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
                  className="cc-assign-times"
                >
                  <div>
                    <div className="cc-field-label" style={{ marginBottom: 6 }}>
                      STARTS
                    </div>
                    <input
                      type="datetime-local"
                      name="startsAtLocal"
                      step={900}
                      defaultValue={toLocalInputValue(w.startsAt)}
                      className="cc-input"
                      required
                    />
                  </div>
                  <div>
                    <div className="cc-field-label" style={{ marginBottom: 6 }}>
                      ENDS
                    </div>
                    <input
                      type="datetime-local"
                      name="endsAtLocal"
                      step={900}
                      defaultValue={toLocalInputValue(w.endsAt)}
                      className="cc-input"
                      required
                    />
                  </div>
                </div>
                <div>
                  <div className="cc-field-label" style={{ marginBottom: 6 }}>
                    NOTES
                  </div>
                  <input
                    type="text"
                    name="notes"
                    defaultValue={w.notes}
                    className="cc-input"
                  />
                </div>
                <div>
                  <Btn variant="primary" size="sm" icon={<Icon.check width={16} height={16} />}>
                    Save changes
                  </Btn>
                </div>
              </form>
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
                        {r.name}
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

        {/* right: who's covering + open gaps + delivery log */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
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
                        <Avatar name={a.respondentName} position={a.tierPosition} />
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
                            {a.tierLabel ?? (a.tierPosition === null ? "Coordinator" : `Tier ${a.tierPosition + 1}`)}
                          </div>
                        </div>
                      </div>
                      <div className="cc-row" style={{ gap: 10, alignItems: "center" }}>
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
                        <form
                          method="post"
                          action={`/api/windows/${w.id}/unassign`}
                          style={{ display: "inline" }}
                        >
                          <input type="hidden" name="assignmentId" value={a.id} />
                          <ConfirmBtn
                            message="Remove this assignment?"
                            variant="ghost"
                            style={{ padding: "4px 8px", fontSize: 12 }}
                          >
                            Remove
                          </ConfirmBtn>
                        </form>
                      </div>
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

          {/* delivery log */}
          <div className="cc-card" style={{ padding: 22, display: "flex", flexDirection: "column" }}>
            <div className="cc-eyebrow" style={{ marginBottom: 10 }}>
              Delivery log
            </div>
            {notifications.length === 0 ? (
              <Note tone="calm" icon={<Icon.bell width={17} height={17} />}>
                No messages sent yet.
              </Note>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {notifications.map((n, i) => (
                  <div key={n.id}>
                    {i > 0 && <hr className="cc-divider" />}
                    <div style={{ padding: "10px 0" }}>
                      <div
                        className="cc-row"
                        style={{
                          justifyContent: "space-between",
                          gap: 10,
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 700 }}>
                          {n.respondent?.name ?? "System"}
                        </span>
                        <span
                          className="cc-row"
                          style={{ gap: 5, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" }}
                        >
                          <span
                            className="cc-dot"
                            style={{
                              background:
                                n.status === "SENT"
                                  ? "var(--covered)"
                                  : n.status === "FAILED"
                                    ? "var(--danger)"
                                    : "var(--await)",
                            }}
                          />
                          {n.status}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: "var(--ink-faint)",
                          marginBottom: 4,
                        }}
                      >
                        {formatTime(n.sentAt)} · {formatDate(n.sentAt)}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--ink-soft)",
                          lineHeight: 1.4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={n.body}
                      >
                        {n.body.length > 80 ? `${n.body.slice(0, 80)}…` : n.body}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
