// Dev helper: with Twilio off, response links are logged instead of texted.
// This prints the most recent ones so you can open them like you'd tap a text.
import pg from "pg";

const DB =
  process.env.DATABASE_URL ?? "postgresql://carecover:carecover@localhost:5435/carecover";

const client = new pg.Client({ connectionString: DB });
await client.connect();
const { rows } = await client.query(
  `SELECT n.body, r.name, r.tier
     FROM "NotificationLog" n
     LEFT JOIN "Respondent" r ON r.id = n."respondentId"
    WHERE n.channel = 'sms' AND n.body LIKE '%/r/%'
    ORDER BY n."sentAt" DESC
    LIMIT 12`,
);
await client.end();

if (rows.length === 0) {
  console.log("No response links yet — post a window first.");
} else {
  console.log("Most recent response links (newest first):\n");
  for (const r of rows) {
    const url = r.body.match(/(https?:\/\/\S+)/)?.[1] ?? "?";
    const who = r.name ? `${r.name} (${r.tier === "TIER1" ? "sister" : "caregiver"})` : "unknown";
    console.log(`  ${who}\n  ${url}\n`);
  }
}
