// CareCover — admin chrome. Calm, desktop-first coordinator shell with a
// warm sidebar; collapses to a simple top bar on phones. Ported from the
// Claude Design handoff and wired to the app's real routes.
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/icons";

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <div className="cc-row" style={{ gap: 10 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.32,
          background: "var(--accent)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 3px 8px var(--accent-glow)",
          flex: "0 0 auto",
        }}
      >
        <Icon.heart width={size * 0.52} height={size * 0.52} />
      </div>
      <span className="cc-serif" style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-.3px" }}>
        CareCover
      </span>
    </div>
  );
}

const NAV = [
  { id: "dash", label: "Coverage", href: "/", icon: <Icon.cal /> },
  { id: "roster", label: "Roster", href: "/respondents", icon: <Icon.users /> },
];

export function AdminShell({
  active,
  title,
  sub,
  actions,
  children,
}: {
  active: "dash" | "roster";
  title: string;
  sub?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="cc" style={{ display: "flex", minHeight: "100vh", background: "var(--sand)" }}>
      {/* sidebar — desktop */}
      <aside
        className="cc-admin-sidebar"
        style={{
          width: 234,
          flex: "0 0 auto",
          background: "var(--card)",
          borderRight: "1px solid var(--line)",
          padding: "24px 18px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "2px 6px 26px" }}>
          <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
            <Logo />
          </Link>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV.map((n) => (
            <Link key={n.id} href={n.href} className={`cc-nav-item${active === n.id ? " is-active" : ""}`}>
              {n.icon}
              {n.label}
            </Link>
          ))}
        </nav>
        <div style={{ marginTop: "auto", padding: 14, background: "var(--card-sunk)", borderRadius: "var(--r)" }}>
          <div className="cc-row" style={{ gap: 11, justifyContent: "space-between" }}>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Coordinator</div>
              <div style={{ fontSize: 12, color: "var(--ink-faint)", fontWeight: 600 }}>Signed in</div>
            </div>
            <form method="post" action="/api/logout">
              <button className="cc-btn cc-btn--ghost cc-btn--sm" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* mobile top bar */}
        <div
          className="cc-admin-topbar"
          style={{
            display: "none",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid var(--line)",
            background: "var(--card)",
          }}
        >
          <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
            <Logo size={26} />
          </Link>
          <nav className="cc-row" style={{ gap: 6 }}>
            {NAV.map((n) => (
              <Link key={n.id} href={n.href} className={`cc-nav-item${active === n.id ? " is-active" : ""}`} style={{ padding: "8px 12px" }}>
                {n.label}
              </Link>
            ))}
          </nav>
        </div>

        <header
          style={{
            padding: "22px 32px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            background: "var(--sand)",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 className="cc-serif" style={{ fontSize: 27, fontWeight: 500, letterSpacing: "-.4px" }}>
              {title}
            </h1>
            {sub && (
              <div style={{ fontSize: 14.5, color: "var(--ink-soft)", fontWeight: 600, marginTop: 2 }}>{sub}</div>
            )}
          </div>
          {actions && (
            <div className="cc-row" style={{ gap: 10, flexWrap: "wrap" }}>
              {actions}
            </div>
          )}
        </header>
        <div style={{ flex: 1, padding: "24px 32px" }}>{children}</div>
      </div>
    </div>
  );
}
