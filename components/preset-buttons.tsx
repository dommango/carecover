"use client";

import { toLocalInputValue } from "@/lib/time";

interface PresetButtonsProps {
  index: number;
  gapStart: Date;
  gapEnd: Date;
}

export function PresetButtons({ index, gapStart, gapEnd }: PresetButtonsProps) {
  const startId = `gap-${index}-start`;
  const endId = `gap-${index}-end`;

  const setValues = (start: Date, end: Date) => {
    const startInput = document.getElementById(startId) as HTMLInputElement | null;
    const endInput = document.getElementById(endId) as HTMLInputElement | null;
    if (startInput) startInput.value = toLocalInputValue(start);
    if (endInput) endInput.value = toLocalInputValue(end);
  };

  const midpoint = new Date((gapStart.getTime() + gapEnd.getTime()) / 2);
  const gapMs = gapEnd.getTime() - gapStart.getTime();
  const gapHours = gapMs / 3_600_000;
  const showLast2h = gapHours > 2;

  const presets = [
    { label: "Take all", start: gapStart, end: gapEnd },
    { label: "First half", start: gapStart, end: midpoint },
    { label: "Last half", start: midpoint, end: gapEnd },
  ];

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
      {presets.map((p) => (
        <button
          key={p.label}
          type="button"
          className="cc-btn cc-btn--secondary cc-btn--sm"
          onClick={() => setValues(p.start, p.end)}
        >
          {p.label}
        </button>
      ))}
      {showLast2h && (
        <button
          type="button"
          className="cc-btn cc-btn--secondary cc-btn--sm"
          onClick={() => setValues(new Date(gapEnd.getTime() - 2 * 3_600_000), gapEnd)}
        >
          Last 2 hours
        </button>
      )}
    </div>
  );
}
