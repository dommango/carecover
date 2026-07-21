import type { CSSProperties } from "react";
import { TASK_TAGS, TASK_TAG_LABELS, isTaskTag } from "@/lib/task-tags";

/** Read-only chips for a window's task types. Renders nothing when empty. */
export function TaskTagChips({ tags, style }: { tags: string[]; style?: CSSProperties }) {
  if (tags.length === 0) return null;
  return (
    <div className="cc-row" style={{ gap: 6, flexWrap: "wrap", ...style }}>
      {tags.map((t) => (
        <span key={t} className="cc-tag">
          {isTaskTag(t) ? TASK_TAG_LABELS[t] : t}
        </span>
      ))}
    </div>
  );
}

/** Checkbox chips posted as `taskTags` form fields. Plain HTML — works without JS. */
export function TaskTagPicker({ defaultSelected = [] }: { defaultSelected?: string[] }) {
  return (
    <div className="cc-row" style={{ gap: 8, flexWrap: "wrap" }}>
      {TASK_TAGS.map((t) => (
        <label key={t} className="cc-tag-pick">
          <input
            type="checkbox"
            name="taskTags"
            value={t}
            defaultChecked={defaultSelected.includes(t)}
          />
          {TASK_TAG_LABELS[t]}
        </label>
      ))}
    </div>
  );
}
