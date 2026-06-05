import pg from "pg";

const BASE = "http://localhost:3010";
const DB = "postgresql://carecover:carecover@localhost:5435/carecover";
const ok = (cond, msg) => {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
  } else console.log("ok  :", msg);
};

const form = (obj) => new URLSearchParams(obj).toString();
const headers = (cookie) => ({
  "content-type": "application/x-www-form-urlencoded",
  ...(cookie ? { cookie } : {}),
});

async function main() {
  // 1. Login
  const login = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: headers(),
    body: form({ password: "dev-change-me" }),
    redirect: "manual",
  });
  ok(login.status === 303, `login redirects (got ${login.status})`);
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
  ok(cookie.startsWith("cc_admin="), "session cookie issued");

  // bad password rejected
  const bad = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: headers(),
    body: form({ password: "wrong" }),
    redirect: "manual",
  });
  ok((bad.headers.get("location") ?? "").includes("error"), "bad password rejected");

  // 2. Respondents
  await fetch(`${BASE}/api/respondents`, {
    method: "POST",
    headers: headers(cookie),
    body: form({ name: "Smoke Sister", phone: "555-100-2000", tier: "TIER1", active: "true" }),
    redirect: "manual",
  });
  await fetch(`${BASE}/api/respondents`, {
    method: "POST",
    headers: headers(cookie),
    body: form({ name: "Smoke CG", phone: "555-100-3000", tier: "TIER2", minShiftMinutes: "120", active: "true" }),
    redirect: "manual",
  });

  // 3. Window (deadline left blank → default)
  const win = await fetch(`${BASE}/api/windows`, {
    method: "POST",
    headers: headers(cookie),
    body: form({ startsAtLocal: "2026-07-20T09:00", endsAtLocal: "2026-07-20T17:00", notes: "Smoke test" }),
    redirect: "manual",
  });
  ok(win.status === 303, "window created");

  // 4. Dashboard renders the window
  const dash = await fetch(`${BASE}/`, { headers: { cookie } });
  const dashHtml = await dash.text();
  ok(dash.status === 200 && dashHtml.includes("Smoke test"), "dashboard shows window");

  // 5. Recover the sister's response token from the logged SMS
  const client = new pg.Client({ connectionString: DB });
  await client.connect();
  const { rows } = await client.query(
    `SELECT body FROM "NotificationLog" WHERE channel='sms' AND body LIKE '%/r/%' ORDER BY "sentAt" DESC LIMIT 1`,
  );
  await client.end();
  const token = rows[0]?.body.match(/\/r\/(\S+)$/)?.[1];
  ok(Boolean(token), "tier-1 SMS logged with response link");

  // 6. Response page loads (no login) and offers acceptance
  const rp = await fetch(`${BASE}/r/${token}`);
  const rpHtml = await rp.text();
  ok(rp.status === 200 && rpHtml.includes("Accept this time"), "response page offers accept");

  // 7. Claim part of the window via token
  const claim = await fetch(`${BASE}/api/respond/${token}`, {
    method: "POST",
    headers: headers(),
    body: form({ action: "claim", startsAtLocal: "2026-07-20T09:00", endsAtLocal: "2026-07-20T13:00" }),
    redirect: "manual",
  });
  ok((claim.headers.get("location") ?? "").includes("status=claimed"), "claim accepted");

  // 8. Cron endpoint requires the secret
  const noSecret = await fetch(`${BASE}/api/cron/check-deadlines`, { method: "POST" });
  ok(noSecret.status === 401, "cron rejects missing secret");
  const cron = await fetch(`${BASE}/api/cron/check-deadlines`, {
    method: "POST",
    headers: { "x-cron-secret": "dev-cron-secret-change-me" },
  });
  ok(cron.status === 200, "cron authorized with secret");
}

main().then(() => console.log(process.exitCode ? "\nSMOKE FAILED" : "\nSMOKE PASSED"));
