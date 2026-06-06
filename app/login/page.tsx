import { Logo } from "@/components/admin-shell";
import { Btn, Note } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main
      className="cc"
      style={{
        minHeight: "100vh",
        background: "var(--sand)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 14,
            marginBottom: 26,
          }}
        >
          <Logo size={44} />
          <div>
            <h1
              className="cc-serif"
              style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-.4px" }}
            >
              CareCover
            </h1>
            <p
              style={{
                fontSize: 14.5,
                color: "var(--ink-soft)",
                fontWeight: 600,
                marginTop: 4,
              }}
            >
              Sign in to manage coverage windows.
            </p>
          </div>
        </div>

        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r)",
            padding: 24,
            boxShadow: "0 4px 18px rgba(60,48,30,.05)",
          }}
        >
          <form
            method="post"
            action="/api/login"
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <label className="cc-field-label" htmlFor="password">
                Admin password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoFocus
                required
                className="cc-input"
              />
            </div>

            {error && <Note tone="bad">Incorrect password.</Note>}

            <Btn variant="primary" size="xl" block>
              Sign in
            </Btn>
          </form>
        </div>
      </div>
    </main>
  );
}
