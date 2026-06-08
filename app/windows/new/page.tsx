import { requireAdmin } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { toLocalInputValue } from "@/lib/time";
import { AdminShell } from "@/components/admin-shell";
import { Btn, BtnLink } from "@/components/ui";
import { Icon } from "@/components/icons";
import { CoverageBar } from "@/components/coverage-bar";

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
  let duplicateWindow = null;
  if (duplicate) {
    duplicateWindow = await prisma.window.findUnique({ where: { id: duplicate } });
  }

  // Defaults are computed fresh per request on this force-dynamic page.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  let previewStart: Date;
  let previewEnd: Date;
  let defaultStart: string;
  let defaultEnd: string;
  let defaultTier1Deadline: string;
  let defaultNotes = "";

  if (duplicateWindow) {
    const originalStart = duplicateWindow.startsAt.getTime();
    const offset = originalStart < now ? 7 * DAY : 0;
    previewStart = new Date(originalStart + offset);
    previewEnd = new Date(duplicateWindow.endsAt.getTime() + offset);
    const shiftedDeadline = new Date(duplicateWindow.tier1DeadlineAt.getTime() + offset);
    defaultStart = toLocalInputValue(previewStart);
    defaultEnd = toLocalInputValue(previewEnd);
    defaultTier1Deadline = toLocalInputValue(shiftedDeadline);
    defaultNotes = duplicateWindow.notes;
  } else {
    previewStart = new Date(Math.ceil((now + HOUR) / QUARTER_HOUR) * QUARTER_HOUR);
    previewEnd = new Date(previewStart.getTime() + 4 * HOUR);
    defaultStart = toLocalInputValue(previewStart);
    defaultEnd = toLocalInputValue(previewEnd);
    defaultTier1Deadline = "";
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
            <input
              type="text"
              name="notes"
              placeholder="e.g. lunch + meds, no driving"
              defaultValue={defaultNotes}
              className="cc-input"
            />
          </div>

          <div>
            <div className="cc-field-label" style={{ marginBottom: 10 }}>
              GIVE FAMILY UNTIL…{" "}
              <span style={{ color: "var(--ink-faint)", fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>
                · then any gaps go to paid caregivers
              </span>
            </div>
            <input
              type="datetime-local"
              name="tier1DeadlineLocal"
              step={900}
              defaultValue={defaultTier1Deadline}
              className="cc-input"
            />
            <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: "var(--ink-faint)", lineHeight: 1.45 }}>
              If left blank, caregivers are contacted automatically after the default window.
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
            <Btn variant="primary" size="xl" block icon={<Icon.send width={18} height={18} />}>
              Post &amp; text the family
            </Btn>
            <BtnLink href="/" variant="ghost" block>
              Cancel
            </BtnLink>
          </div>
        </form>

        {/* ---- live preview ---- */}
        <div className="cc-card" style={{ padding: 24, alignSelf: "start" }}>
          <div className="cc-eyebrow" style={{ marginBottom: 16 }}>
            What the family sees
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
                Set the day &amp; time on the left
              </div>
            </div>
          </div>

          <CoverageBar
            startsAt={previewStart}
            endsAt={previewEnd}
            size="lg"
            segments={[{ start: previewStart, end: previewEnd, kind: "gap", label: "Open to family first" }]}
          />

          <div className="cc-divider" style={{ margin: "20px 0" }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="cc-row" style={{ gap: 11, alignItems: "flex-start" }}>
              <span style={{ color: "var(--accent)", marginTop: 1 }}>
                <Icon.send width={18} height={18} />
              </span>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-soft)", lineHeight: 1.4 }}>
                Texts the family a link to claim any part.
              </div>
            </div>
            <div className="cc-row" style={{ gap: 11, alignItems: "flex-start" }}>
              <span style={{ color: "var(--await-ink)", marginTop: 1 }}>
                <Icon.clock width={18} height={18} />
              </span>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-soft)", lineHeight: 1.4 }}>
                Then any gaps go to caregivers who fit.
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
