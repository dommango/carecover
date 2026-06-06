// CareCover — shared icon set (ported from the Claude Design handoff).
// Thin, rounded line icons that match the warm, calm visual language.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  width: 20,
  height: 20,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const Icon = {
  cal: (p: IconProps) => (
    <svg {...base} {...p}>
      <rect x="3.5" y="5" width="17" height="16" rx="3" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </svg>
  ),
  clock: (p: IconProps) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  ),
  phone: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M6.5 3.5h11a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path d="M10.5 17.5h3" />
    </svg>
  ),
  bell: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  ),
  check: (p: IconProps) => (
    <svg {...base} strokeWidth={2.4} {...p}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  ),
  plus: (p: IconProps) => (
    <svg {...base} strokeWidth={2.2} {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  heart: (p: IconProps) => (
    <svg {...base} fill="currentColor" stroke="none" {...p}>
      <path d="M12 20s-7-4.4-7-9.3A4 4 0 0 1 12 7.6 4 4 0 0 1 19 10.7C19 15.6 12 20 12 20Z" />
    </svg>
  ),
  users: (p: IconProps) => (
    <svg {...base} {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 13.5A5.5 5.5 0 0 1 20.5 19" />
    </svg>
  ),
  hand: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V10m0-.5V4.5a1.5 1.5 0 0 1 3 0V10m0-.5V6a1.5 1.5 0 0 1 3 0v6.5c0 3.6-2.4 6.5-6 6.5-2.2 0-3.6-.8-4.8-2.3L5 14.2a1.5 1.5 0 0 1 2.3-1.9L8 13" />
    </svg>
  ),
  flag: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M6 21V4M6 4.5h11l-2.2 4L17 13H6" />
    </svg>
  ),
  chevR: (p: IconProps) => (
    <svg {...base} strokeWidth={2.1} {...p}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  ),
  chevL: (p: IconProps) => (
    <svg {...base} strokeWidth={2.1} {...p}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  ),
  x: (p: IconProps) => (
    <svg {...base} strokeWidth={2.1} {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  send: (p: IconProps) => (
    <svg {...base} {...p}>
      <path d="M21 4 3 11l7 2 2 7 9-16Z" />
      <path d="M10 13 21 4" />
    </svg>
  ),
  sun: (p: IconProps) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19" />
    </svg>
  ),
};

export type IconKey = keyof typeof Icon;
