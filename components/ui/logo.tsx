"use client";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <path
        d="M24 30 L40 30 C40 22 37 15 32 13 C27 15 24 22 24 30 C19 36 12 43 12 53 C19 62 45 62 52 53 C52 43 45 36 40 30 L24 30 Z"
        stroke="currentColor"
        strokeWidth="5.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Full brand mark WITH the four cycle nodes — for hero / marketing / splash at
// ≥64px. `stroke` defaults to the brand gradient via a per-instance gradient;
// when used on a colored tile, pass `tile` to render white on the gradient.
export function LogoFull({
  className,
  tile = false,
}: {
  className?: string;
  tile?: boolean;
}) {
  const path =
    "M24 30 L40 30 C40 22 37 15 32 13 C27 15 24 22 24 30 C19 36 12 43 12 53 C19 62 45 62 52 53 C52 43 45 36 40 30 L24 30 Z";
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      {tile && (
        <>
          <defs>
            <linearGradient id="af-tile" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
              <stop stopColor="#4338CA" />
              <stop offset=".5" stopColor="#3B82F6" />
              <stop offset="1" stopColor="#22D3EE" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#af-tile)" />
        </>
      )}
      <path
        d={path}
        stroke={tile ? "#ffffff" : "url(#af-stroke)"}
        strokeWidth={tile ? 4.6 : 4.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {!tile && (
        <defs>
          <linearGradient id="af-stroke" x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6366F1" />
            <stop offset=".5" stopColor="#3B82F6" />
            <stop offset="1" stopColor="#22D3EE" />
          </linearGradient>
        </defs>
      )}
      <g fill="#7C3AED">
        <circle cx="37" cy="20" r="3.4" />
        <circle cx="52" cy="53" r="3.4" />
        <circle cx="12" cy="53" r="3.4" />
        <circle cx="27" cy="20" r="3.4" />
      </g>
    </svg>
  );
}