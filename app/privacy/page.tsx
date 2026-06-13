import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — CareCover",
};

const sectionStyle = { display: "flex", flexDirection: "column" as const, gap: 8 };
const hStyle = { fontSize: 17, fontWeight: 700, marginTop: 10 };
const pStyle = { fontSize: 14.5, color: "var(--ink-soft)", lineHeight: 1.6 };

export default function PrivacyPage() {
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
          Privacy Policy
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
            <h2 style={hStyle}>Who we are</h2>
            <p style={pStyle}>
              CareCover is a private, family-operated application used to coordinate caregiving
              coverage for a family member. It is operated by the account owner and is not a
              commercial service open to the public.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={hStyle}>Information we collect</h2>
            <p style={pStyle}>
              We store the name and mobile phone number of each family member or caregiver the
              account owner adds, the caregiving time windows they are invited to cover, their
              responses (accepted, declined, or canceled coverage), and a log of text messages
              sent to them, kept for delivery troubleshooting.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={hStyle}>How we use it</h2>
            <p style={pStyle}>
              This information is used solely to coordinate caregiving shifts: to send you a text
              message when coverage is needed, to record which part of a shift you accepted, and
              to notify the account owner of schedule changes. We do not use it for advertising
              or any other purpose.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={hStyle}>SMS consent and sharing</h2>
            <p style={pStyle}>
              No mobile information will be shared with third parties or affiliates for marketing
              or promotional purposes. Text messaging originator opt-in data and consent will not
              be shared with any third parties. Phone numbers are shared only with our SMS
              delivery provider (Twilio) to the extent necessary to deliver the messages you have
              consented to receive.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={hStyle}>Opting out</h2>
            <p style={pStyle}>
              You may opt out of text messages at any time by replying STOP to any message, or by
              asking the account owner to remove you from the roster, which takes effect
              immediately.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2 style={hStyle}>Contact</h2>
            <p style={pStyle}>
              Questions about this policy or your data can be sent to dommango@gmail.com.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
