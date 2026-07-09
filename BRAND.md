# AgentFlow AI — Brand System v1.0

> *The AI-Native Automation Platform.*

One idea drives the whole identity: **a single continuous loop that carries an
agent through Plan → Reason → Execute → Learn → Continuous Improvement.** Every
mark below is a geometric expression of that loop — no generic AI clichés
(robot heads, brains, circuits, bolts, hexagons, letters-in-rounded-squares).

Open `brand/showcase.html` in a browser to see everything rendered live.

---

## 1. The Mark — Concept B: "The Flow Loop" (v2, final identity)

One **continuous closed path** — the workflow loop is the foundation and the
**dominant gesture**. The lower **execution swoop** carries ~1.8× the mass of
the upper region, so the mark reads *loop first*. The upper counter hides a
subtle **"A"** (rounded apex + short waist crossbar) as a **reveal** — you see
the loop, then notice the brand initial. Four balanced nodes ride the loop at
Plan → Reason → Execute → Learn (clockwise).

**Hidden meaning inside the geometry**
- The one continuous path = **continuous execution** (nothing terminates).
- The upper counter's hidden "A" = **AgentFlow** — the brand, never drawn as a
  literal letter, only suggested by the loop's own negative space.
- The waist crossbar = the **agent** (where input crosses to output).
- The execution swoop = the loop **always continues** past each step.
- The four nodes = **Plan · Reason · Execute · Learn** — the operating loop.

**Refinement notes (v2 — final)**
- Stroke thickened ~14% (3.6 → 4.1) for weight and presence.
- Perfect bilateral symmetry; apex, crossbar, feet, and nodes centered on x=32.
- Every terminal and corner rounded consistently (round caps + round joins).
- **Loop-dominant**: lower swoop enlarged (feet 12/52, dip to y=62); upper
  A-region compressed and softened so the loop reads first, the A as a reveal.
- "A" is *hidden, not explicit*: broad rounded apex, short integrated crossbar.
- Simplified silhouette: a single dot-free path for ≤32px; cycle nodes from ≥64px.
- Scales cleanly: recognizable at 16/24/32/48/64/128/512/1024px.

**Why it wins**
- Instantly recognizable without text — ownable loop silhouette with a secret.
- Perfect bilateral symmetry; memorable, balanced geometry.
- Original — reads as a bespoke flow mark, not the n8n/Zapier flowchart glyph.

It feels like **Linear × Stripe × OpenAI × Vercel**: abstract, geometric,
gradient-forward, enterprise-credible — but with a hidden "A" that makes it
yours.

---

## 2. All Five Concepts — Audit verdict

| Concept | Name | Verdict | File |
|---|---|---|---|
| A | Interconnected Nodes | ❌ Reject — generic network diagram, dies at 16px, no automation meaning | `brand/concept-a.svg` |
| **B** | **The Flow Loop** | **✅ SELECTED — only one that encodes product behavior (continuous loop) + a brand reveal** | `brand/concept-b.svg` |
| C | Autonomous Agent Network | ❌ Reject — atom/orbit cliché, dashed ring breaks at small sizes | `brand/concept-c.svg` |
| D | Geometric "A" | ❌ Reject as primary — literal letterform, no AI/workflow meaning, collides with Adobe/Airbnb; its name-tie idea was absorbed into B | `brand/concept-d.svg` |
| E | Continuous Loop | ❌ Reject — reads as a loading/refresh ring, no meaning or name tie | `brand/concept-e.svg` |

**Why B wins.** A, C, E are generic symbols. D is a letterform. Only B encodes
the *behavior* of the product — a continuous operating loop
(Planning → Reasoning → Execution → Learning → Continuous Improvement) — and
only B has a *reveal* (the hidden "A"), which is what makes a mark stick.

---

## 3. Adaptations

| Asset | Use | File |
|---|---|---|
| Gradient mark (with nodes) | Primary digital use, ≥64px | `brand/concept-b.svg` |
| Favicon | Browser tab (dot-free, crisp at 16px) | `brand/favicon.svg` |
| App icon | iOS/Android/desktop tile (gradient + white loop) | `brand/app-icon.svg` |
| Monochrome / light ink | Print, etch, single-color, light UI | `brand/concept-b-mono.svg` |
| Dark ink | Near-white loop on dark surfaces | `brand/concept-b-dark.svg` |
| Spinner | Loading / processing states | `brand/spinner.svg` |
| Animated | Intro / hero / idle / splash | `brand/animated-mark.svg` |
| Splash screen | Boot / app launch (1024 square, animated) | `brand/splash.svg` |
| Social preview | Open Graph / X / LinkedIn card (1200×630) | `brand/social-preview.svg` |

### Scale rules
- **≤24px** (favicon, tiny UI): use the **dot-free** loop — `favicon.svg`.
- **32–64px** (navbar, sidebar): dot-free loop is cleanest; dots optional from 64px.
- **≥64px** (hero, marketing): full mark with the four cycle nodes.

---

## 4. Color

**Brand gradient** (diagonal, indigo → blue → cyan):
```
#6366F1  →  #3B82F6  →  #22D3EE
```

| Role | Hex |
|---|---|
| Deep Indigo | `#4338CA` |
| Indigo | `#6366F1` |
| Electric Blue | `#3B82F6` |
| Cyan | `#22D3EE` |
| Purple (accent / nodes) | `#7C3AED` |
| Slate ink (dark surface) | `#0B1020` / `#11182E` |
| Slate text (light mode) | `#0F172A` |

**Dark mode**: gradient loop on `#0B1020`. **Light mode**: indigo→cyan loop on
white, or the mono `#0F172A` form. **Monochrome**: single-color form for print.

Never: recolor the gradient, add drop shadows/glows, or use more than the two
brand accent colors in the mark itself.

---

## 5. Typography

- **Display & UI**: `Geist` (already wired into the Next.js app). Weights 450–650.
  Tracking -.02em (display) / -.01em (UI headings).
- **Alternative**: `Inter`.
- **Mono** (code, logs, tokens): `Geist Mono`.
- **Numerals**: tabular figures in dashboards.

| Token | Size | Weight | Tracking |
|---|---|---|---|
| H1 | 40px | 650 | -.02em |
| H2 | 22px | 650 | -.01em |
| Body | 16px | 450 | 0, line-height 1.6 |
| Caption | 12px | 450 (muted) | 0 |

---

## 6. Spacing (8pt base)

```
4 · 8 · 12 · 16 · 24 · 32 · 48 · 64
```

**Clear-space**: keep a minimum margin around the logo equal to **1× the mark
height**. **Minimum size**: 16px (favicon) / 24px (in-app UI) / 32px (marketing).

---

## 7. Usage — Do / Don't

**Do**
- Use the gradient loop on dark; white or mono loop on light.
- Respect the clear-space rule.
- Drop the cycle nodes below 64px.

**Don't**
- Recolor the gradient or add shadows/glows.
- Stretch, rotate, or place on busy imagery without a contrast scrim.
- Substitute generic AI icons (robot, brain, circuit, lightning, hexagon).

---

## 8. Motion

- **Intro**: the loop **draws in** as a single stroke (`stroke-dashoffset` → 0),
  then the four nodes pop in clockwise.
- **Processing**: a short segment **travels the loop** continuously (the spinner).
- **Success**: the loop completes and pulses cyan once.
- **Idle**: nodes breathe (opacity 1 ↔ .2) in sequence — a live agent.
- **Page load**: logo draws, then settles into the favicon state.

Rules: motion ≤400ms, ease-out, one gesture at a time, honor
`prefers-reduced-motion`.

---

## 9. Implementation in this repo

- Primary UI glyph: `components/ui/logo.tsx` → `<LogoMark />` (dot-free,
  `currentColor`, used in navbar, sidebar, topbar at 16–32px).
- Full mark with cycle nodes: `<LogoFull />` in the same file (hero/marketing).
- Favicon / app icon: `app/icon.svg` (Next.js serves it automatically).
- Loading screen: `app/loading.tsx` — the Flow Loop flows while routes boot.
- Brand source SVGs, spinner, animated mark, splash, social preview, and the
  `showcase.html` gallery all live in `/brand`.

The v2 path is the single source of truth:
```
M24 30 L40 30 C40 22 37 15 32 13 C27 15 24 22 24 30 C19 36 12 43 12 53
C19 62 45 62 52 53 C52 43 45 36 40 30 L24 30 Z
```

To switch the live mark to a different concept, copy that concept's `<path>` into
`LogoMark` and `app/icon.svg`.