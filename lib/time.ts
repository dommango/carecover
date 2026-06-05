// Time + phone helpers. Times are stored as UTC instants; admins enter and read
// them in a single configured wall-clock zone (APP_TIMEZONE).

const defaultTz = () => process.env.APP_TIMEZONE ?? "America/New_York";

/**
 * Normalize a US phone number to E.164 (+1XXXXXXXXXX). Accepts already-E.164
 * input for other countries (leading +). Throws on anything implausible.
 */
export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) {
      throw new Error("Invalid phone number.");
    }
    return `+${digits}`;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  throw new Error("Invalid phone number. Use a 10-digit US number or +E.164.");
}

// Offset (ms) between the given zone's wall clock and UTC at `date`.
function zoneOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

/**
 * Convert a naive local datetime (as produced by an <input type="datetime-local">,
 * e.g. "2026-06-10T09:00") interpreted in `tz` into a UTC Date instant.
 */
export function zonedWallTimeToUtc(naive: string, tz = defaultTz()): Date {
  const m = naive.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) throw new Error("Invalid datetime-local value.");
  const [, y, mo, d, h, mi] = m.map(Number);
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi);
  const offset = zoneOffsetMs(new Date(utcGuess), tz);
  return new Date(utcGuess - offset);
}

/** Render a UTC instant as a "YYYY-MM-DDTHH:mm" value for <input type="datetime-local"> in `tz`. */
export function toLocalInputValue(date: Date, tz = defaultTz()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

const dateFmt = (tz: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const timeFmt = (tz: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  });

export function formatDate(date: Date, tz = defaultTz()): string {
  return dateFmt(tz).format(date);
}

export function formatTime(date: Date, tz = defaultTz()): string {
  return timeFmt(tz).format(date);
}

/** "Wed, Jun 10 · 9:00 AM–1:00 PM" — same-day range collapsed to one date. */
export function formatRange(start: Date, end: Date, tz = defaultTz()): string {
  const sameDay = formatDate(start, tz) === formatDate(end, tz);
  return sameDay
    ? `${formatDate(start, tz)} · ${formatTime(start, tz)}–${formatTime(end, tz)}`
    : `${formatDate(start, tz)} ${formatTime(start, tz)} – ${formatDate(end, tz)} ${formatTime(end, tz)}`;
}
