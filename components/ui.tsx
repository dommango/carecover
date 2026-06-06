// CareCover — shared design-system primitives (the kit in code).
// Buttons, status badges, tier labels, avatars, person chips, legend,
// countdown and notes. Ported from the Claude Design handoff and wired
// to the app's real data (TIER1/TIER2, WindowStatus).
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/icons";

type Tier = "TIER1" | "TIER2" | "family" | "caregiver";
type WindowStatus = "OPEN_TIER1" | "ESCALATED_TIER2" | "FILLED" | "CLOSED" | "EXPIRED";

/* ----------  helpers  ---------- */
export function tierKind(tier: Tier): "family" | "caregiver" {
  return tier === "TIER2" || tier === "caregiver" ? "caregiver" : "family";
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Format an hour-count as "4h", "1h 30m", "45m". */
export function durLabel(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/* ----------  Buttons  ---------- */
type Variant = "primary" | "secondary" | "ghost" | "danger-ghost";
type Size = "sm" | "xl";

export function btnClass(variant: Variant = "primary", size?: Size, block?: boolean): string {
  return [
    "cc-btn",
    `cc-btn--${variant}`,
    size && `cc-btn--${size}`,
    block && "cc-btn--block",
  ]
    .filter(Boolean)
    .join(" ");
}

export function Btn({
  variant = "primary",
  size,
  block,
  children,
  icon,
  iconR,
  type = "submit",
  ...rest
}: {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  children: ReactNode;
  icon?: ReactNode;
  iconR?: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={btnClass(variant, size, block)} type={type} {...rest}>
      {icon}
      {children}
      {iconR}
    </button>
  );
}

/** A link styled as a button (for navigation between pages). */
export function BtnLink({
  href,
  variant = "primary",
  size,
  block,
  children,
  icon,
  iconR,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  children: ReactNode;
  icon?: ReactNode;
  iconR?: ReactNode;
}) {
  return (
    <Link href={href} className={btnClass(variant, size, block)}>
      {icon}
      {children}
      {iconR}
    </Link>
  );
}

/* ----------  Status badge  ---------- */
type BadgeKind = "open" | "await" | "covered" | "escalated" | "gap" | "attention" | "expired";

const BADGE_LABEL: Record<BadgeKind, string> = {
  open: "Open to family",
  await: "Partly covered",
  covered: "Fully covered",
  escalated: "With caregivers",
  gap: "Has a gap",
  attention: "Needs you",
  expired: "Expired",
};

export function StatusBadge({ kind, label }: { kind: BadgeKind; label?: string }) {
  return (
    <span className={`cc-badge cc-badge--${kind}`}>
      <span className="cc-dot" />
      {label ?? BADGE_LABEL[kind]}
    </span>
  );
}

/** Map a real window status (+ coverage) to a badge kind & label. */
export function windowBadge(
  status: WindowStatus,
  coveredPercent: number,
  hasFlaggedGap = false,
): { kind: BadgeKind; label: string } {
  if (hasFlaggedGap && (status === "OPEN_TIER1" || status === "ESCALATED_TIER2"))
    return { kind: "attention", label: "Needs you" };
  switch (status) {
    case "OPEN_TIER1":
      return coveredPercent > 0
        ? { kind: "await", label: "Partly covered" }
        : { kind: "open", label: "Open to family" };
    case "ESCALATED_TIER2":
      return { kind: "escalated", label: "With caregivers" };
    case "FILLED":
      return { kind: "covered", label: "Fully covered" };
    case "CLOSED":
      return { kind: "gap", label: "Closed" };
    case "EXPIRED":
      return { kind: "expired", label: "Expired" };
  }
}

/* ----------  Tier label  ---------- */
export function TierLabel({ tier }: { tier: Tier }) {
  if (tierKind(tier) === "caregiver")
    return (
      <span className="cc-tier cc-tier--caregiver">
        <Icon.hand />
        Paid caregiver
      </span>
    );
  return (
    <span className="cc-tier cc-tier--family">
      <Icon.heart />
      Family
    </span>
  );
}

/* ----------  Avatar + person chip  ---------- */
export function Avatar({
  name,
  tier,
  size,
  ring,
}: {
  name: string;
  tier: Tier;
  size?: "sm" | "lg";
  ring?: boolean;
}) {
  const kind = tierKind(tier);
  const cls = [
    "cc-avatar",
    `cc-avatar--${kind}`,
    size && `cc-avatar--${size}`,
    ring && "cc-avatar--ring",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} style={ring ? { color: `var(--${kind})` } : undefined}>
      {initialsFor(name)}
    </div>
  );
}

export function PersonChip({ name, tier }: { name: string; tier: Tier }) {
  return (
    <span className="cc-chip">
      <Avatar name={name} tier={tier} />
      <span>{name.split(/\s+/)[0]}</span>
    </span>
  );
}

/* ----------  Coverage legend  ---------- */
type LegendKind = "family" | "caregiver" | "covered" | "await" | "gap";
const LEGEND_SW: Record<LegendKind, string> = {
  family: "var(--family)",
  caregiver: "var(--caregiver)",
  covered: "var(--covered)",
  await: "var(--await)",
  gap: "var(--gap-tint)",
};

export function CovLegend({ items }: { items: { kind: LegendKind; label: string }[] }) {
  return (
    <div className="cc-legend">
      {items.map((it) => (
        <span key={it.kind} className="cc-legend-item">
          <span
            className="cc-legend-sw"
            style={{
              background: LEGEND_SW[it.kind],
              boxShadow: it.kind === "gap" ? "inset 0 0 0 1px rgba(120,108,90,.2)" : "none",
            }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/* ----------  Countdown  ---------- */
export function Countdown({ value, unit = "left" }: { value: string; unit?: string }) {
  return (
    <span className="cc-countdown">
      <Icon.clock width={15} height={15} style={{ marginRight: 1 }} />
      <b>{value}</b>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{unit}</span>
    </span>
  );
}

/* ----------  Note / callout  ---------- */
export function Note({
  tone = "await",
  icon,
  children,
  style,
}: {
  tone?: "await" | "calm" | "good" | "bad";
  icon?: ReactNode;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  const toneCls = tone === "await" ? "" : ` cc-note--${tone}`;
  return (
    <div className={`cc-note${toneCls}`} style={style}>
      {icon && <span className="cc-note-ic">{icon}</span>}
      <span>{children}</span>
    </div>
  );
}
