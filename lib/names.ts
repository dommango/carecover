/**
 * First name only. Outbound SMS bodies and event-log rows use this instead of
 * full names so NotificationLog and carrier-side storage hold minimal PII.
 */
export function firstNameOf(name: string): string {
  return name.split(/\s+/)[0] || name;
}
