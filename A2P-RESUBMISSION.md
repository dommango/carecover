# A2P 10DLC Campaign — Resubmission Notes

Prior submission was **rejected as P2P** (person-to-person), which A2P does not permit.
Root cause: the description leaned on "private, single-family… one account owner…
personally added… not a commercial service," which reads as one human texting their
own contacts. The fix is to reframe CareCover as a **commercial software platform that
sends automated, templated, transactional notifications** — currently in a limited pilot.

Commercial intent is an *asset* here: A2P 10DLC exists for business/application
messaging. Lead with it.

## Highest-leverage change (do before resubmitting)

- **Register the TCR brand under a business entity, not a personal name.** A personal/
  sole-prop brand + single-family description is what triggers the P2P label. Even a
  single-member LLC makes the campaign read as legitimate A2P. (Action item: create the
  entity.)
- Use a **transactional / notification** standard use case (not "low volume mixed").

## Field-by-field values to submit

### Campaign description
> CareCover is a commercial software platform that coordinates caregiving schedules for
> account owners and their care networks. When the application detects an uncovered
> caregiving time window, it automatically sends templated SMS notifications with a
> secure link to registered, opted-in caregivers and family members, who tap to accept
> all or part of a shift. All messages are generated and dispatched programmatically by
> the application in response to scheduling events — transactional coverage-coordination
> notifications, not conversational or marketing messages. The service is currently in a
> limited pilot ahead of broader commercial availability.

Avoid: "single-family," "one account owner," "personally added," "not a commercial service."

### Sample message #1 (coverage request)
> CareCover: Coverage is needed Sat Jun 21, 2–6pm for your family member. Tap to accept
> all or part: https://web-production-cb6320.up.railway.app/r/abc123 — Reply STOP to opt
> out, HELP for help.

### Sample message #2 (coverage request)
> CareCover: Open caregiving time still needs coverage Sun 9am–12pm. Tap to claim:
> https://web-production-cb6320.up.railway.app/r/def456 — Reply STOP to opt out.

### Sample message #3 (opt-in confirmation — MUST match production code exactly)
> CareCover: You've been added to receive caregiving shift coordination texts. Msg
> frequency varies; msg & data rates may apply. Reply STOP to opt out, HELP for help.
> Terms: https://web-production-cb6320.up.railway.app/terms

### Sample message #4 (shift confirmed)
> CareCover: You're confirmed for the caregiving shift Mon Jun 23, 8am–12pm. Thank you.
> Reply STOP to opt out, HELP for help.

### Sample message #5 (request cancelled)
> CareCover: A coverage request you accepted (Tue 1–4pm) is no longer needed and was
> cancelled. No action required. Reply STOP to opt out, HELP for help.

### Privacy policy
https://web-production-cb6320.up.railway.app/privacy

### Terms of service
https://web-production-cb6320.up.railway.app/terms

### How end-users consent
> End users are caregivers and family members registered by the account owner, who
> provide their mobile number and consent directly. They are not solicited or acquired
> through any website, ad, or purchased list. The account owner enters the number into
> the application, and the application immediately sends a one-time opt-in confirmation
> text identifying the program, stating message frequency, and explaining how to opt out
> (Reply STOP) and get help (Reply HELP). Only after this opt-in confirmation does the
> person receive coverage-request texts. Full program terms and the opt-out method are
> published at https://web-production-cb6320.up.railway.app/terms and the privacy policy
> at https://web-production-cb6320.up.railway.app/privacy. No mobile numbers are
> purchased, rented, sold, or shared with third parties except Twilio for message delivery.

### Opt-in keywords
START, UNSTOP
(Handled by Twilio at the Messaging Service / carrier level, not in app code.)

### Opt-in message (MUST match production code — see lib/respondents.ts optInBody())
> CareCover: You've been added to receive caregiving shift coordination texts. Msg
> frequency varies; msg & data rates may apply. Reply STOP to opt out, HELP for help.
> Terms: https://web-production-cb6320.up.railway.app/terms

### Opt-out keywords
OPTOUT, CANCEL, END, QUIT, UNSUBSCRIBE, REVOKE, STOP, STOPALL

### Opt-out message
> You have successfully been unsubscribed. You will not receive any more messages from
> this number. Reply START to resubscribe.

### Help keywords
HELP, INFO

### Help message
> Reply STOP to unsubscribe. Msg&Data Rates May Apply.

## Code verification (done 2026-06-21)

- ✅ **Opt-in confirmation is real.** `lib/respondents.ts` `createRespondent()` sends
  `optInBody()` on the initial add only, for active respondents only, before any coverage
  text. Attestation is truthful.
- ✅ **Terms link added** to `optInBody()` this session (was brand + frequency + STOP/HELP;
  now also `Terms: {APP_BASE_URL}/terms`). Integration test updated to assert `/terms`.
  Not run locally — Docker/Postgres unavailable in this WSL distro; verified via `tsc`.
- ⚠️ **No inbound SMS webhook / no opt-out state in app.** STOP/HELP/START rely entirely
  on Twilio carrier-level handling — fine for registration. Operational wart: after a
  STOP, the respondent stays `active: true`, so future sends are attempted and rejected
  (Twilio err 21610 → FAILED in NotificationLog). Future cleanup, not a blocker.
- ℹ️ SMS only actually sends when all three `TWILIO_*` env vars are set (`lib/sms.ts` /
  `smsEnabled`); otherwise messages are logged to NotificationLog. Confirm Twilio vars
  are set in the Railway prod service before relying on live opt-in delivery.
