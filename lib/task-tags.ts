// The only vocabulary for describing what a window involves. Deliberately
// non-clinical: windows are described by time, task type, and logistics —
// never by who care is for or any health detail (see CLAUDE.md invariants).
export const TASK_TAGS = ["MEALS", "TRANSPORT", "COMPANY", "HOUSEHOLD", "OVERNIGHT"] as const;

export type TaskTag = (typeof TASK_TAGS)[number];

export const TASK_TAG_LABELS: Record<TaskTag, string> = {
  MEALS: "Meals",
  TRANSPORT: "Transport",
  COMPANY: "Company",
  HOUSEHOLD: "Household",
  OVERNIGHT: "Overnight",
};

export function isTaskTag(value: string): value is TaskTag {
  return (TASK_TAGS as readonly string[]).includes(value);
}
