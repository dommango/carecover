"use client";

import { useState } from "react";
import { btnClass } from "@/components/ui";
import { Icon } from "@/components/icons";

export interface EditorPerson {
  id: string;
  name: string;
}

export interface InitialTier {
  label: string;
  claimRule: "PARTIAL" | "WHOLE_GAP";
  minShiftMinutes: number;
  leadHours: string;
  memberIds: string[];
}

interface TierState {
  label: string;
  claimRule: "PARTIAL" | "WHOLE_GAP";
  minShiftMinutes: number;
  leadHours: string;
  memberIds: string[];
}

const DEFAULT_TIER: TierState = {
  label: "",
  claimRule: "PARTIAL",
  minShiftMinutes: 240,
  leadHours: "12",
  memberIds: [],
};

/**
 * Builds a window's ordered escalation ladder. Each tier emits indexed form fields
 * (`tiers[i][...]`) that the create route reconstructs. The last tier has no
 * escalation lead (it's terminal). Requires JS; the server renders a single default
 * tier as a no-JS fallback.
 */
export function TierEditor({
  respondents,
  initialTiers,
}: {
  respondents: EditorPerson[];
  initialTiers?: InitialTier[];
}) {
  const [tiers, setTiers] = useState<TierState[]>(
    initialTiers && initialTiers.length > 0 ? initialTiers : [{ ...DEFAULT_TIER }],
  );

  const update = (i: number, patch: Partial<TierState>) =>
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));

  const addTier = () =>
    setTiers((prev) => [
      ...prev,
      { ...DEFAULT_TIER, claimRule: "WHOLE_GAP", label: "" },
    ]);

  const removeTier = (i: number) => setTiers((prev) => prev.filter((_, idx) => idx !== i));

  const toggleMember = (i: number, id: string) =>
    setTiers((prev) =>
      prev.map((t, idx) =>
        idx === i
          ? {
              ...t,
              memberIds: t.memberIds.includes(id)
                ? t.memberIds.filter((m) => m !== id)
                : [...t.memberIds, id],
            }
          : t,
      ),
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="cc-field-label">WHO TO ASK, IN ORDER</div>

      {tiers.map((tier, i) => {
        const isLast = i === tiers.length - 1;
        return (
          <div
            key={i}
            className="cc-card"
            style={{
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              borderLeft: `4px solid var(--tier-${i % 4})`,
            }}
          >
            <div className="cc-row" style={{ justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: `var(--tier-${i % 4})` }}>
                TIER {i + 1}
                {i === 0 ? " · asked first" : isLast ? " · last resort" : ""}
              </span>
              {tiers.length > 1 && (
                <button
                  type="button"
                  className={btnClass("danger-ghost", "sm")}
                  onClick={() => removeTier(i)}
                >
                  Remove
                </button>
              )}
            </div>

            {/* hidden inputs that actually submit (controlled by state) */}
            <input type="hidden" name={`tiers[${i}][label]`} value={tier.label} />
            <input type="hidden" name={`tiers[${i}][claimRule]`} value={tier.claimRule} />
            {tier.claimRule === "WHOLE_GAP" && (
              <input
                type="hidden"
                name={`tiers[${i}][minShiftMinutes]`}
                value={tier.minShiftMinutes}
              />
            )}
            {!isLast && (
              <input type="hidden" name={`tiers[${i}][leadHours]`} value={tier.leadHours} />
            )}
            {tier.memberIds.map((id) => (
              <input key={id} type="hidden" name={`tiers[${i}][respondentIds]`} value={id} />
            ))}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 10,
              }}
            >
              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span className="cc-field-label">LABEL (optional)</span>
                <input
                  className="cc-input"
                  placeholder={i === 0 ? "e.g. Family" : "e.g. Caregivers"}
                  value={tier.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span className="cc-field-label">CAN CLAIM</span>
                <select
                  className="cc-input"
                  value={tier.claimRule}
                  onChange={(e) =>
                    update(i, { claimRule: e.target.value as TierState["claimRule"] })
                  }
                >
                  <option value="PARTIAL">Any part of a gap</option>
                  <option value="WHOLE_GAP">Whole gaps only</option>
                </select>
              </label>
              {tier.claimRule === "WHOLE_GAP" && (
                <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <span className="cc-field-label">MIN SHIFT (MIN)</span>
                  <input
                    className="cc-input"
                    type="number"
                    min={15}
                    max={1440}
                    step={15}
                    value={tier.minShiftMinutes}
                    onChange={(e) => update(i, { minShiftMinutes: Number(e.target.value) })}
                  />
                </label>
              )}
              {!isLast && (
                <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <span className="cc-field-label">ESCALATE (H BEFORE START)</span>
                  <input
                    className="cc-input"
                    type="number"
                    min={0}
                    max={720}
                    value={tier.leadHours}
                    onChange={(e) => update(i, { leadHours: e.target.value })}
                  />
                </label>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="cc-field-label">PEOPLE</span>
              {respondents.length === 0 ? (
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-faint)" }}>
                  No active people on the roster yet.
                </p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {respondents.map((p) => {
                    const on = tier.memberIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleMember(i, p.id)}
                        className="cc-chip"
                        style={{
                          cursor: "pointer",
                          border: "none",
                          boxShadow: on
                            ? `inset 0 0 0 2px var(--tier-${i % 4})`
                            : "inset 0 0 0 1px var(--line)",
                          background: on ? `var(--tier-${i % 4}-tint)` : "var(--card)",
                          fontWeight: on ? 800 : 600,
                        }}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}

      <button
        type="button"
        className={btnClass("secondary", "sm")}
        onClick={addTier}
        style={{ alignSelf: "flex-start" }}
      >
        <Icon.plus width={15} height={15} />
        Add a tier
      </button>
    </div>
  );
}
