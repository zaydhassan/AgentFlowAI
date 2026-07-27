"use client";

// Right-rail table of contents with scrollspy. Watches each <section id> in the
// article body via IntersectionObserver and highlights the entry for whichever
// section is currently in view. Clicking an entry smooth-scrolls to it.
//
// "On this page" stays useful on long articles; on short ones it still lists the
// sections for orientation. Hidden below `lg` (the right rail only exists on
// wide screens).

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { DocSection } from "@/lib/docs/navigation";

export function TableOfContents({ sections }: { sections: DocSection[] }) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost intersecting section.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: [0, 1] },
    );

    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  if (sections.length === 0) return null;

  return (
    <nav aria-label="On this page" className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
        On this page
      </h3>
      <ul className="space-y-2.5 border-l border-border">
        {sections.map((s) => {
          const active = activeId === s.id;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById(s.id);
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                    history.replaceState(null, "", `#${s.id}`);
                  }
                }}
                className={cn(
                  "-ml-px block border-l-2 py-0.5 pl-3 text-[13px] leading-snug transition-colors",
                  active
                    ? "border-brand text-fg"
                    : "border-transparent text-fg-muted hover:text-fg hover:border-border-strong",
                )}
              >
                {s.title}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}