import { requireAdmin } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { activeRespondents } from "@/lib/respondents";
import { toLocalInputValue } from "@/lib/time";
import { AdminShell } from "@/components/admin-shell";
import { Btn, BtnLink } from "@/components/ui";
import { Icon } from "@/components/icons";
import { CoverageBar } from "@/components/coverage-bar";
import { TierEditor, type InitialTier } from "@/components/tier-editor";
import { TaskTagPicker } from "@/components/task-tags";

export const dynamic = "force-dynamic";

const QUARTER_HOUR = 15 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export default async function NewWindowPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicate?: string }>;
}) {
  await requireAdmin();

  const { duplicate } = await searchParams;
  const [respondents, duplicateWindow] = await Promise.all([
    activeRespondents(),
    duplicate
      ? prisma.window.findUnique({
          where: { id: duplicate },
          include: { tiers: { include: { members: true }, orderBy: { position: "asc" } } },
        })
      : Promise.resolve(null),
  ]);

  // Defaults are computed fresh per request on this force-dynamic page.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  let previewStart: Date;
  let previewEnd: Date;
  let defaultStart: string;
  let defaultEnd: string;
  let defaultNotes = "";
  let defaultTags: string[] = [];
  let initialTiers: InitialTier[] | undefined;

  if (duplicateWindow) {
    const originalStart = duplicateWindow.startsAt.getTime();
    const offset = originalStart < now ? 7 * DAY : 0;
    previewStart = new Date(originalStart + offset);
    previewEnd = new Date(duplicateWindow.endsAt.getTime() + offset);
    defaultStart = toLocalInputValue(previewStart);
    defaultEnd = toLocalInputValue(previewEnd);
    defaultNotes = duplicateWindow.notes;
    defaultTags = duplicateWindow.taskTags;
    initialTiers = duplicateWindow.tiers.map((t) => ({
      label: t.label ?? "",
      claimRule: t.claimRule,
      minShiftMinutes: t.minShiftMinutes,
      leadHours:
        t.deadlineAt != null
          ? String(Math.round((originalStart - t.deadlineAt.getTime()) / HOUR))
          : "12",
      memberIds: t.members.map((m) => m.respondentId),
    }));
  } else {
    previewStart = new Date(Math.ceil((now + HOUR) / QUARTER_HOUR) * QUARTER_HOUR);
    previewEnd = new Date(previewStart.getTime() + 4 * HOUR);
    defaultStart = toLocalInputValue(previewStart);
    defaultEnd = toLocalInputValue(previewEnd);
  }

  return (
    <AdminShell
      active="dash"
      title="Post a window"
      sub="Tell us when coverage is needed — we'll handle the asking."
    >
      <div className="cc-post-grid">
        {/* ---- form ---- */}
        <form method="post" action="/api/windows" style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div>
            <div className="cc-field-label" style={{ marginBottom: 10 }}>
              WHICH DAY &amp; TIME?{" "}
              <span style={{ color: "var(--ink-faint)", fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>
                · steps by 15 min, shown in ET
              </span>
            </div>
            <div className="cc-post-times">
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-faint)", letterSpacing: ".3px" }}>
                  STARTS
                </span>
                <input
                  type="datetime-local"
                  name="startsAtLocal"
                  defaultValue={defaultStart}
                  step={900}
                  required
                  className="cc-input"
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-faint)", letterSpacing: ".3px" }}>
                  ENDS
                </span>
                <input
                  type="datetime-local"
                  name="endsAtLocal"
                  defaultValue={defaultEnd}
                  step={900}
                  required
                  className="cc-input"
                />
              </label>
            </div>
          </div>

          <div>
            <div className="cc-field-label" style={{ marginBottom: 10 }}>
              WHAT&apos;S NEEDED?{" "}
              <span style={{ color: "var(--ink-faint)", fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>
                · optional
              </span>
            </div>
            <TaskTagPicker defaultSelected={defaultTags} />
            <input
              type="text"
              name="notes"
              placeholder="e.g. key under the mat, park in the driveway"
              defaultValue={defaultNotes}
              className="cc-input"
              style={{ marginTop: 10 }}
            />
            <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 600, color: "var(--ink-faint)" }}>
              Don&apos;t include medical details — share those in person.
            </div>
          </div>

          {/* fallback for the rare no-JS case: a single default tier the editor replaces */}
          <noscript>
            <input type="hidden" name="tiers[0][claimRule]" value="PARTIAL" />
          </noscript>

          <TierEditor
            respondents={respondents.map((r) => ({ id: r.id, name: r.name }))}
            initialTiers={initialTiers}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
            <Btn variant="primary" size="xl" block icon={<Icon.send width={18} height={18} />}>
              Post &amp; text the first tier
            </Btn>
            <BtnLink href="/" variant="ghost" block>
              Cancel
            </BtnLink>
          </div>
        </form>

        {/* ---- live preview ---- */}
        <div className="cc-card" style={{ padding: 24, alignSelf: "start" }}>
          <div className="cc-eyebrow" style={{ marginBottom: 16 }}>
            How it works
          </div>
          <div className="cc-row" style={{ gap: 13, marginBottom: 18 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                flex: "0 0 auto",
                background: "var(--accent-tint)",
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon.clock width={22} height={22} />
            </div>
            <div style={{ lineHeight: 1.2 }}>
              <div className="cc-serif" style={{ fontSize: 19, fontWeight: 500 }}>
                A new coverage window
              </div>
              <div style={{ fontSize: 14, color: "var(--ink-soft)", fontWeight: 700 }}>
                Set the day, time &amp; tiers on the left
              </div>
            </div>
          </div>

          <CoverageBar
            startsAt={previewStart}
            endsAt={previewEnd}
            size="lg"
            segments={[{ start: previewStart, end: previewEnd, kind: "gap", label: "Open to tier 1 first" }]}
          />

          <div className="cc-divider" style={{ margin: "20px 0" }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="cc-row" style={{ gap: 11, alignItems: "flex-start" }}>
              <span style={{ color: "var(--accent)", marginTop: 1 }}>
                <Icon.send width={18} height={18} />
              </span>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-soft)", lineHeight: 1.4 }}>
                Texts tier 1 a link to claim right away.
              </div>
            </div>
            <div className="cc-row" style={{ gap: 11, alignItems: "flex-start" }}>
              <span style={{ color: "var(--await-ink)", marginTop: 1 }}>
                <Icon.clock width={18} height={18} />
              </span>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-soft)", lineHeight: 1.4 }}>
                At each tier&apos;s deadline, remaining gaps cascade to the next tier.
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
