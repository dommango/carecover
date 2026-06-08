import { requireAdmin } from "@/lib/guard";
import { listRespondents, getRespondentStats, type RespondentStats } from "@/lib/respondents";
import { AdminShell } from "@/components/admin-shell";
import { Avatar, Btn, Note, TierLabel } from "@/components/ui";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

type Respondent = Awaited<ReturnType<typeof listRespondents>>[number];

function StatsLine({ stats }: { stats?: RespondentStats }) {
  if (!stats) return null;
  const rate = stats.invites > 0 ? Math.round((stats.claims / stats.invites) * 100) : 0;
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        fontSize: 12.5,
        fontWeight: 700,
        color: "var(--ink-faint)",
        marginTop: 2,
      }}
    >
      <span>Claimed {stats.claims} of {stats.invites} shifts</span>
      {stats.invites > 0 && <span>· {rate}% response rate</span>}
    </div>
  );
}

function PersonCard({ r, stats }: { r: Respondent; stats?: RespondentStats }) {
  return (
    <form
      method="post"
      action={`/api/respondents/${r.id}`}
      className="cc-card"
      style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div className="cc-row" style={{ gap: 13 }}>
        <Avatar name={r.name} tier={r.tier} size="lg" />
        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{r.name}</div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-faint)" }}>
            {r.phone}
          </div>
          <StatsLine stats={stats} />
        </div>
        {r.tier === "TIER2" && (
          <div style={{ textAlign: "right", flex: "0 0 auto" }}>
            <div className="cc-eyebrow" style={{ fontSize: 10.5 }}>Min shift</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "var(--caregiver-ink)", marginTop: 1 }}>
              {Math.round(r.minShiftMinutes / 60)}h
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="cc-field-label">NAME</span>
          <input name="name" defaultValue={r.name} className="cc-input" style={{ padding: "10px 12px", fontSize: 15 }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="cc-field-label">PHONE</span>
          <input name="phone" defaultValue={r.phone} className="cc-input" style={{ padding: "10px 12px", fontSize: 15 }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="cc-field-label">TIER</span>
          <select name="tier" defaultValue={r.tier} className="cc-input" style={{ padding: "10px 12px", fontSize: 15 }}>
            <option value="TIER1">Family (Tier 1)</option>
            <option value="TIER2">Caregiver (Tier 2)</option>
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="cc-field-label">MIN SHIFT (MIN)</span>
          <input
            name="minShiftMinutes"
            type="number"
            min={15}
            max={1440}
            step={15}
            defaultValue={r.minShiftMinutes}
            className="cc-input"
            style={{ padding: "10px 12px", fontSize: 15 }}
          />
        </label>
      </div>

      <div className="cc-row" style={{ justifyContent: "space-between", gap: 12 }}>
        <label className="cc-row" style={{ gap: 8, fontSize: 14, fontWeight: 600, color: "var(--ink-soft)" }}>
          <input name="active" type="checkbox" defaultChecked={r.active} />
          <span>Active</span>
        </label>
        <Btn variant="secondary" size="sm">Save</Btn>
      </div>
    </form>
  );
}

function PersonGroup({
  tier,
  caption,
  people,
  statsMap,
}: {
  tier: "family" | "caregiver";
  caption: string;
  people: Respondent[];
  statsMap: Map<string, RespondentStats>;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="cc-row" style={{ justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
        <TierLabel tier={tier} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-faint)" }}>{caption}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {people.length === 0 && (
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-faint)" }}>No one here yet.</p>
        )}
        {people.map((r) => (
          <PersonCard key={r.id} r={r} stats={statsMap.get(r.id)} />
        ))}
      </div>
    </div>
  );
}

export default async function RespondentsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { error } = await searchParams;
  const [respondents, statsList] = await Promise.all([listRespondents(), getRespondentStats()]);
  const statsMap = new Map(statsList.map((s) => [s.respondentId, s]));

  const family = respondents.filter((r) => r.tier === "TIER1");
  const caregivers = respondents.filter((r) => r.tier === "TIER2");

  return (
    <AdminShell active="roster" title="Roster" sub="The people we text when coverage is needed">
      <div style={{ maxWidth: 1080, display: "flex", flexDirection: "column", gap: 24 }}>
        {error === "phone" && (
          <Note tone="bad" icon={<Icon.flag />}>That phone number didn&apos;t look valid.</Note>
        )}

        {/* add a person */}
        <div className="cc-card" style={{ padding: 22 }}>
          <div className="cc-eyebrow" style={{ marginBottom: 16 }}>Add a person</div>
          <form
            method="post"
            action="/api/respondents"
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 14,
              }}
            >
              <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <span className="cc-field-label">NAME</span>
                <input name="name" required className="cc-input" />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <span className="cc-field-label">PHONE</span>
                <input name="phone" placeholder="555-123-4567" required className="cc-input" />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <span className="cc-field-label">TIER</span>
                <select name="tier" defaultValue="TIER1" className="cc-input">
                  <option value="TIER1">Family (Tier 1)</option>
                  <option value="TIER2">Caregiver (Tier 2)</option>
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <span className="cc-field-label">MIN SHIFT (MIN)</span>
                <input
                  name="minShiftMinutes"
                  type="number"
                  min={15}
                  max={1440}
                  step={15}
                  defaultValue={240}
                  className="cc-input"
                />
              </label>
            </div>
            <input type="hidden" name="active" value="true" />
            <div className="cc-row" style={{ justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-faint)", lineHeight: 1.4, maxWidth: 460 }}>
                Minimum shift applies to caregivers only — gaps shorter than this aren&apos;t texted to
                them.
              </p>
              <Btn variant="primary" icon={<Icon.plus />}>Add a person</Btn>
            </div>
          </form>
        </div>

        {/* grouped lists */}
        {respondents.length === 0 ? (
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-faint)" }}>No one on the roster yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-7 md:grid-cols-2">
            <PersonGroup tier="family" caption="Asked first · can take any part" people={family} statsMap={statsMap} />
            <PersonGroup tier="caregiver" caption="Asked if a gap is left · whole shifts" people={caregivers} statsMap={statsMap} />
          </div>
        )}
      </div>
    </AdminShell>
  );
}
