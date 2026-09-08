import { cn } from "@/lib/utils";

/**
 * DaddyAI brand mark — single source of truth for the logo.
 * Replaces the `▣` dingbat used ad hoc across pages and the PNG asset.
 * Draws a clean "message bubble" with a spark, matching the brand green.
 */
export function DaddyAILogo({
  size = 28,
  className,
  colored = true,
}: {
  size?: number;
  className?: string;
  colored?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="DaddyAI"
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id="dai-logo-g" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#68f044" />
          <stop offset="1" stopColor="#20d878" />
        </linearGradient>
      </defs>
      {/* Rounded square tile */}
      <rect x="2" y="2" width="44" height="44" rx="12" fill="url(#dai-logo-g)" />
      {/* Chat bubble */}
      <path
        d="M14 14h20a4 4 0 0 1 4 4v11a4 4 0 0 1-4 4h-9l-6 5v-5h-5a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4z"
        fill="#06130d"
        opacity="0.9"
      />
      {/* Spark / AI star */}
      <path
        d="M24 20.5l1.6 3.4 3.4 1.6-3.4 1.6L24 30.5l-1.6-3.4-3.4-1.6 3.4-1.6L24 20.5z"
        fill="#68f044"
      />
      <circle cx="31.5" cy="22" r="1.6" fill="#68f044" />
    </svg>
  );
}
