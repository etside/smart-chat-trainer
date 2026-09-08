export { DaddyAILogo } from "./DaddyAILogo";
import { cn } from "@/lib/utils";
import { SVGProps } from "react";

/**
 * Shared SVG icon components — replaces emoji across the entire app.
 * Each icon is a self-contained SVG with currentColor fill, 24px default viewBox.
 * Use `size` for width/height, `className` for overrides.
 */

type IconProps = { size?: number; className?: string } & Omit<SVGProps<SVGSVGElement>, "width" | "height">;

function wrap(size: number, children: React.ReactNode, cls?: string, extra?: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", cls)}
      {...extra}
    >
      {children}
    </svg>
  );
}

// ── Free / No-cost ──────────────────────────────────────────────────────────
export function FreeIcon({ size = 18, className }: IconProps) {
  return wrap(
    size,
    <>
      <path
        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
        fill="#68f044"
        stroke="#68f044"
        strokeWidth="0.5"
      />
      <text x="12" y="15" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#06130d">
        $
      </text>
    </>,
    className
  );
}

// ── Brain / Intelligence ─────────────────────────────────────────────────────
export function BrainIcon({ size = 20, className }: IconProps) {
  return wrap(
    size,
    <>
      <path
        d="M12 4a6 6 0 0 1 3 11.2V21l-3-2-3 2v-5.8A6 6 0 0 1 12 4z"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" fillOpacity="0.3" />
      <path
        d="M12 9.5v5M9.5 12h5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </>,
    className
  );
}

// ── Lightning / Fast / Real-time ────────────────────────────────────────────
export function LightningIcon({ size = 18, className }: IconProps) {
  return wrap(
    size,
    <path
      d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"
      fill="#68f044"
      stroke="#68f044"
      strokeWidth="0.5"
      strokeLinejoin="round"
    />,
    className
  );
}

// ── Globe / Web / Multi-language ────────────────────────────────────────────
export function GlobeIcon({ size = 18, className }: IconProps) {
  return wrap(
    size,
    <g stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="3" ry="9" />
      <path d="M3 12h18" />
    </g>,
    className
  );
}

// ── Chat / Message ──────────────────────────────────────────────────────────
export function ChatIcon({ size = 18, className }: IconProps) {
  return wrap(
    size,
    <path
      d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"
      stroke="currentColor"
      strokeWidth="1.6"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />,
    className
  );
}

// ── Bot / AI Robot ──────────────────────────────────────────────────────────
export function BotIcon({ size = 20, className }: IconProps) {
  return wrap(
    size,
    <g stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="6" width="16" height="11" rx="3" />
      <circle cx="9" cy="12" r="1.5" fill="currentColor" />
      <circle cx="15" cy="12" r="1.5" fill="currentColor" />
      <path d="M9 17Q12 19 15 17" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <circle cx="12" cy="2" r="1.5" fill="currentColor" stroke="none" />
    </g>,
    className
  );
}

// ── Check / Success ─────────────────────────────────────────────────────────
export function CheckIcon({ size = 16, className }: IconProps) {
  return wrap(
    size,
    <path
      d="M5 13l3 3 8-8"
      stroke="#68f044"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />,
    className
  );
}

// ── Arrow Right ─────────────────────────────────────────────────────────────
export function ArrowRightIcon({ size = 16, className }: IconProps) {
  return wrap(
    size,
    <path
      d="M5 12h12m-4-4l4 4-4 4"
      stroke="currentColor"
      strokeWidth="1.8"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />,
    className
  );
}

// ── Play / Video ────────────────────────────────────────────────────────────
export function PlayIcon({ size = 16, className }: IconProps) {
  return wrap(
    size,
    <path
      d="M6 4l13 8-13 8V4z"
      fill="#68f044"
      stroke="#68f044"
      strokeWidth="0.5"
      strokeLinejoin="round"
    />,
    className
  );
}

// ── Smile / Happy ───────────────────────────────────────────────────────────
export function SmileIcon({ size = 16, className }: IconProps) {
  return wrap(
    size,
    <g stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14c1.5 2 4.5 2 6 0" />
      <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
    </g>,
    className
  );
}

// ── Bangladesh Flag (text + circle) ─────────────────────────────────────────
export function BangladeshIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={cn("shrink-0", className)} aria-label="Bangladesh">
      <rect x="2" y="6" width="44" height="36" rx="4" fill="#006a4e" />
      <circle cx="20" cy="24" r="10" fill="#f42a41" />
    </svg>
  );
}

// ── Heart / Loyalty ─────────────────────────────────────────────────────────
export function HeartIcon({ size = 16, className }: IconProps) {
  return wrap(
    size,
    <path
      d="M12 21s-8-5.5-8-10c0-3 2-5 5-5 2 0 3 1 3 1s1-1 3-1c3 0 5 2 5 5 0 4.5-8 10-8 10z"
      stroke="#68f044"
      strokeWidth="1.5"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />,
    className
  );
}

// ── Shopping / Cart ─────────────────────────────────────────────────────────
export function CartIcon({ size = 16, className }: IconProps) {
  return wrap(
    size,
    <g stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </g>,
    className
  );
}

// ── Fire / Hot / Trending ───────────────────────────────────────────────────
export function FireIcon({ size = 16, className }: IconProps) {
  return wrap(
    size,
    <path
      d="M12 22c-4 0-7-2.5-7-7 0-3.5 3-7 7-11 4 4 7 7.5 7 11 0 4.5-3 7-7 7z"
      stroke="#ef4444"
      strokeWidth="1.5"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />,
    className
  );
}

// ── Rocket / Launch ─────────────────────────────────────────────────────────
export function RocketIcon({ size = 16, className }: IconProps) {
  return wrap(
    size,
    <g stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.3-3 4-3 6s2.7 1.5 6-3" />
      <path d="M19.5 7.5c1.5-1.3 3-4 3-6s-2.7-1.5-6 3" />
      <path d="M12 12l-4 4 2 2 6-6" />
      <circle cx="15" cy="9" r="1" fill="currentColor" stroke="none" />
    </g>,
    className
  );
}

// ── Warning / Alert ─────────────────────────────────────────────────────────
export function WarningIcon({ size = 16, className }: IconProps) {
  return wrap(
    size,
    <g stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3L2 21h20L12 3z" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="none" />
    </g>,
    className
  );
}

// ── Settings / Gear ─────────────────────────────────────────────────────────
export function GearIcon({ size = 16, className }: IconProps) {
  return wrap(
    size,
    <g stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </g>,
    className
  );
}

// ── Fish / cute ─────────────────────────────────────────────────────────────
export function FishIcon({ size = 16, className }: IconProps) {
  return wrap(
    size,
    <g stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12c0-4 3-8 10-8s10 4 10 8-3 8-10 8-10-4-10-8z" />
      <path d="M16 12c0-3 2-5 5-6 0 4-2 6-5 6z" />
      <circle cx="8" cy="12" r="1" fill="currentColor" stroke="none" />
    </g>,
    className
  );
}

// ── Sparkle / ✦ ────────────────────────────────────────────────────────────
export function SparkleIcon({ size = 16, className }: IconProps) {
  return wrap(
    size,
    <path
      d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z"
      fill="#68f044"
      stroke="#68f044"
      strokeWidth="0.5"
    />,
    className
  );
}

// ── Arrow Up Right ──────────────────────────────────────────────────────────
export function ArrowUpRightIcon({ size = 16, className }: IconProps) {
  return wrap(
    size,
    <path
      d="M7 17L17 7M7 7h10v10"
      stroke="currentColor"
      strokeWidth="1.8"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />,
    className
  );
}

// ── Diamond ─────────────────────────────────────────────────────────────────
export function DiamondIcon({ size = 16, className }: IconProps) {
  return wrap(
    size,
    <path
      d="M12 2l10 10-10 10L2 12 12 2z"
      stroke="#68f044"
      strokeWidth="1.5"
      fill="none"
      strokeLinejoin="round"
    />,
    className
  );
}

// ── Toggle (for ◌ dot) ────────────────────────────────────────────────────
export function DotIcon({ size = 8, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" className={cn("shrink-0", className)}>
      <circle cx="4" cy="4" r="3" fill="currentColor" />
    </svg>
  );
}

// ── Bar Chart / Analytics ───────────────────────────────────────────────────
export function BarChart3Icon({ size = 20, className }: IconProps) {
  return wrap(
    size,
    <g stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="12" y1="20" x2="12" y2="8" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="3" y1="21" x2="21" y2="21" />
    </g>,
    className
  );
}

// ── Plug / Integration ───────────────────────────────────────────────────────
export function PlugIcon({ size = 20, className }: IconProps) {
  return wrap(
    size,
    <g stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22v-5" />
      <path d="M9 8V2M15 8V2M6 8h12v4a6 6 0 0 1-12 0V8z" />
    </g>,
    className
  );
}

// ── Shield / Security ───────────────────────────────────────────────────────
export function ShieldIcon({ size = 20, className }: IconProps) {
  return wrap(
    size,
    <g stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </g>,
    className
  );
}