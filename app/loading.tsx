// AgentFlow AI — root loading screen.
// Shown by the App Router while route segments are rendering/suspending.
// Premium, calm, on-brand: the Flow Loop flows while the app boots.
const LOOP =
  "M24 30 L40 30 C40 22 37 15 32 13 C27 15 24 22 24 30 C19 36 12 43 12 53 C19 62 45 62 52 53 C52 43 45 36 40 30 L24 30 Z";

export default function Loading() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.25rem",
        background: "var(--color-bg)",
        color: "var(--color-fg)",
        zIndex: 50,
      }}
    >
      <svg viewBox="0 0 64 64" width="56" height="56" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="af-load" x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6366F1" />
            <stop offset=".5" stopColor="#3B82F6" />
            <stop offset="1" stopColor="#22D3EE" />
          </linearGradient>
        </defs>
        {/* faint full loop */}
        <path
          d={LOOP}
          stroke="var(--color-fg-subtle)"
          strokeOpacity="0.25"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* traveling gradient arc — continuous execution */}
        <path
          d={LOOP}
          stroke="url(#af-load)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="44 130"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="-174"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </path>
      </svg>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 600,
            fontSize: "1.05rem",
            letterSpacing: "-0.01em",
          }}
        >
          AgentFlow
        </span>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 500,
            fontSize: "1.05rem",
            background: "linear-gradient(90deg,#6366F1,#3B82F6,#22D3EE)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          AI
        </span>
      </div>
    </div>
  );
}