"use client";

// Reusable dropdown/popover/menu primitive.
//
// Why this exists: the app's dropdowns (top-nav notifications, the shared
// profile/UserMenu) each rolled their own open/close state with a full-viewport
// invisible overlay to fake outside-click detection. That overlay is a custom
// hack (no Radix/shadcn is installed, so we can't use DismissableLayer), and it
// had two real problems: (1) it didn't always capture clicks (stacking-context
// issues with backdrop-blur), so outside clicks didn't close the menu; and
// (2) there was no coordination between dropdowns, so two could be open at once.
//
// This hook replaces the overlay hack with document-level pointer/keydown
// listeners and adds a global "only one dropdown open at a time" registry so
// opening one dropdown closes any other. It is the single place future
// dropdowns should call into.
//
// Behaviour guarantees (see the matching task requirements):
//  - Outside click closes the open dropdown.                     (#1, #4)
//  - Escape closes the open dropdown and returns focus to trigger. (#2, #7)
//  - Opening one dropdown closes any other (global registry).      (#3)
//  - Clicking inside the panel does NOT close it (only menu actions,
//    which call setOpen(false)/close themselves, do).             (#5)
//  - Every listener is removed on unmount / when closed.           (#6)
//
// Usage:
//   const { open, setOpen, close, toggle, panelRef, triggerRef } =
//     useDropdown<HTMLButtonElement>("user-menu");
//   <button ref={triggerRef} onClick={toggle} aria-expanded={open} ... />
//   {open && <div ref={panelRef} role="menu">...</div>}

import { useCallback, useEffect, useRef, useState } from "react";

export type DropdownOptions = {
  /** Return focus to the trigger when the dropdown is dismissed via Escape (default true). */
  returnFocusOnEscape?: boolean;
};

// ─── Global single-open registry ─────────────────────────────────────────────
// Module-scoped so dropdowns anywhere in the tree coordinate without a shared
// parent or React context. When a dropdown opens it claims `activeId`; every
// other open dropdown is told to close silently (without clearing the registry,
// so the just-opened dropdown keeps its slot).

type ActiveListener = (activeId: string | null) => void;

let activeId: string | null = null;
const listeners = new Set<ActiveListener>();

function setActive(id: string | null): void {
  if (activeId === id) return;
  activeId = id;
  for (const l of listeners) l(activeId);
}

function subscribe(l: ActiveListener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/**
 * Controlled-ish dropdown state with outside-click + Escape dismissal and
 * global single-open coordination. `T` is the trigger element type so the
 * returned `triggerRef` attaches cleanly to the trigger (e.g. HTMLButtonElement).
 */
export function useDropdown<T extends HTMLElement = HTMLElement>(
  id: string,
  opts: DropdownOptions = {},
) {
  const returnFocusOnEscape = opts.returnFocusOnEscape ?? true;

  const [open, setOpenState] = useState(false);
  // Mirror of `open` readable inside event handlers without a stale closure
  // (and without putting a side effect inside a state updater).
  const openRef = useRef(false);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<T | null>(null);

  const setOpen = useCallback(
    (next: boolean) => {
      openRef.current = next;
      setOpenState(next);
      setActive(next ? id : null);
    },
    [id],
  );

  const close = useCallback(() => setOpen(false), [setOpen]);
  const toggle = useCallback(() => setOpen(!openRef.current), [setOpen]);

  // Close silently when ANOTHER dropdown claims the single-open slot. We must
  // NOT call setActive(null) here — that would clear the slot the other dropdown
  // just claimed. Just flip our own state.
  useEffect(() => {
    const onActive = (other: string | null) => {
      if (other !== null && other !== id && openRef.current) {
        openRef.current = false;
        setOpenState(false);
      }
    };
    return subscribe(onActive);
  }, [id]);

  // Outside-click + Escape, attached only while open so the opening click can't
  // immediately dismiss. Listeners are torn down on close/unmount (#6).
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return; // inside panel → keep open (#5)
      if (triggerRef.current?.contains(target)) return; // trigger → toggle handles it
      close();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        if (returnFocusOnEscape) triggerRef.current?.focus();
      }
    };

    // Capture phase so we evaluate the target before the trigger's click fires.
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close, returnFocusOnEscape]);

  // If unmounted while still the active dropdown, relinquish the slot so a
  // stale id doesn't keep blocking others (and so reopen works).
  useEffect(() => {
    return () => {
      if (activeId === id) activeId = null;
    };
  }, [id]);

  return { open, setOpen, close, toggle, panelRef, triggerRef } as const;
}