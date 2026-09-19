"use client";

// Hero background — subtle blue ambient glow + fine technical grid.
// Deliberately restrained: one glow field, one ring, a faint grid.

export function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Soft radial base — a single blue ambient glow. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(33,150,243,0.10), transparent 70%), radial-gradient(40% 40% at 80% 30%, rgba(66,165,245,0.05), transparent 70%)",
        }}
      />

      {/* Fine grid with a radial fade mask. */}
      <div className="grid-overlay absolute inset-0 [mask-image:radial-gradient(75%_65%_at_50%_30%,#000,transparent)]" />

      {/* Single slow-drifting blue glow field. */}
      <div className="aurora-blob aurora-1" style={{ width: 480, height: 480, top: "-8%", left: "-6%" }} />

      {/* Orbital ring — one faint concentric ellipse. */}
      <div className="orbital-ring" style={{ width: 520, height: 520, top: "8%", left: "calc(50% - 260px)" }} />

      {/* Bottom fade into the page background for a seamless seam. */}
      <div
        className="absolute inset-x-0 bottom-0 h-32"
        style={{ background: "linear-gradient(to bottom, transparent, var(--color-bg))" }}
      />
    </div>
  );
}