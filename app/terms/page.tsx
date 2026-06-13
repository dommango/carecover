import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions — CareCover",
};

const sectionStyle = { display: "flex", flexDirection: "column" as const, gap: 8 };
const hStyle = { fontSize: 17, fontWeight: 700, marginTop: 10 };
const pStyle = { fontSize: 14.5, color: "var(--ink-soft)", lineHeight: 1.6 };

export default function TermsPage() {
  return (
    <main
      className="cc"
      style={{
        minHeight: "100vh",
        background: "var(--sand)",
        display: "flex",
        justifyContent: "center",
        padding: "40px 24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 640 }}>
        <h1
          className="cc-serif"
          style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-.4px", marginBottom: 6 }}
        >
          Terms &amp; Conditions
        </h1>
        <p style={{ ...pStyle, marginBottom: 22 }}>CareCover · Last updated June 12, 2026</p>

        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r)",
            padding: 28,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <section style={sectionStyle}>
            <h2 style={hStyle}>The service</h2>
            <p style={pStyle}>
              CareCover is a private application that helps one family coordinate caregiving
              coverage windows. Invited family members and pre-arranged caregivers receive text
              messages with a secure link to view a caregiving shift and accept all or part of
              it. Use of the service is by personal invitation from the account owner only.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={hStyle}>SMS program terms</h2>
            <p style={pStyle}>
              By giving the account owner your phone number and consent, you agree to receive
              text messages about caregiving shift coordination: coverage requests, reminders,
              and schedule-change notifications. Message frequency varies with the family&apos;s
              caregiving schedule and is typically a few messages per week. Message and data
              rates may apply. Carriers are not liable for delayed or undelivered messages.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={hStyle}>Opting out and help</h2>
            <p style={pStyle}>
              Reply STOP to any message to stop receiving texts. Reply HELP for help, or contact
              the account owner at dommango@gmail.com. You can also ask the account owner to
              remove you from the roster at any time.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={hStyle}>Acceptable use</h2>
            <p style={pStyle}>
              Response links sent by text are personal to you and should not be forwarded.
              Claiming a shift is a commitment to the family; if you can no longer cover a
              claimed shift, use the cancel option in your response link so the time can be
              re-offered.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={hStyle}>No warranty</h2>
            <p style={pStyle}>
              The service is provided as-is for private family use, without warranties of any
              kind. The account owner may modify or discontinue it at any time.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={hStyle}>Contact</h2>
            <p style={pStyle}>Questions about these terms: dommango@gmail.com.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
