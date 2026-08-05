// Trust strip — "Built for modern AI automation".
// Premium monochrome logo set (Linear/Vercel/Stripe register): uniform muted
// wordmarks that brighten + lift to brand color on hover. Rendered as an
// infinite auto-scrolling marquee that pauses on hover. Pure CSS animation
// keeps this a server component. Logos are stylized fictional wordmarks (no
// third-party trademarks); marks render in `currentColor` so the whole logo
// is one tone. The track is duplicated so translateX(-50%) loops seamlessly;
// spacing uses right margin (not flex gap) to keep the seam continuous.

type Shape = "hex" | "ring" | "tri" | "dot" | "wave" | "grid" | "orb" | "stack";

const COMPANIES: { name: string; shape: Shape }[] = [
  { name: "Northwind", shape: "hex" },
  { name: "Quantix", shape: "ring" },
  { name: "Helios AI", shape: "tri" },
  { name: "Vertex", shape: "stack" },
  { name: "Lumen", shape: "wave" },
  { name: "Cortex", shape: "grid" },
  { name: "Nimbus", shape: "orb" },
];

function Mark({ shape }: { shape: Shape }) {
  const fill = { fill: "currentColor", "aria-hidden": true } as const;
  const stroke = { fill: "none", stroke: "currentColor", "aria-hidden": true } as const;
  const sz = { width: 22, height: 22, viewBox: "0 0 24 24" };
  switch (shape) {
    case "hex":
      return (
        <svg {...sz} {...fill}>
          <path d="M12 2l8.66 5v10L12 22 3.34 17V7L12 2z" />
        </svg>
      );
    case "ring":
      return (
        <svg {...sz} {...stroke} strokeWidth={2.4}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
    case "tri":
      return (
        <svg {...sz} {...fill}>
          <path d="M12 3l9 16H3z" />
        </svg>
      );
    case "stack":
      return (
        <svg {...sz} {...stroke} strokeWidth={2.2} strokeLinecap="round">
          <path d="M12 3l9 5-9 5-9-5 9-5z" />
          <path d="M3 13l9 5 9-5" />
        </svg>
      );
    case "wave":
      return (
        <svg {...sz} {...stroke} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 14c3-6 5-6 8 0s5 6 8 0l4-2" />
        </svg>
      );
    case "grid":
      return (
        <svg {...sz} {...fill}>
          <rect x="3" y="3" width="8" height="8" rx="2" />
          <rect x="13" y="13" width="8" height="8" rx="2" />
          <rect x="13" y="3" width="8" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
          <rect x="3" y="13" width="8" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "orb":
      return (
        <svg {...sz} {...stroke} strokeWidth={2.4}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
      );
  }
}

function Logo({ name, shape }: { name: string; shape: Shape }) {
  return (
    <span
      className="trust-logo inline-flex shrink-0 items-center gap-2.5 select-none mr-12 lg:mr-16"
      title={name}
    >
      <Mark shape={shape} />
      <span className="text-lg font-semibold tracking-tight whitespace-nowrap">{name}</span>
    </span>
  );
}

export function TrustLogos() {
  return (
    <section className="border-b border-border bg-bg-soft/30">
      <div className="mx-auto max-w-7xl px-5 lg:px-8 py-16">
        <p className="text-center text-[11px] font-medium uppercase tracking-[0.25em] text-fg-subtle">
          Built for modern AI automation
        </p>
        <div className="marquee mt-10">
          <div className="marquee-track">
            {COMPANIES.map((c) => (
              <Logo key={c.name} name={c.name} shape={c.shape} />
            ))}
            {COMPANIES.map((c) => (
              <Logo key={`${c.name}-dup`} name={c.name} shape={c.shape} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}