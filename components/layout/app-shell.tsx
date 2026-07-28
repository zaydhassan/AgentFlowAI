"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";

type ShellUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: ShellUser;
}) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      } else if (e.key === "Escape") {
        setCmdOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Mobile sidebar drawer: lock body scroll while open and auto-close if the
  // viewport grows back to desktop (lg = 1024px) so the two never overlap.
  useEffect(() => {
    if (!sidebarOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onResize = () => {
      if (window.innerWidth >= 1024) setSidebarOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("resize", onResize);
    };
  }, [sidebarOpen]);

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} onOpenCommand={() => setCmdOpen(true)} onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} onOpenCommand={() => setCmdOpen(true)} />
    </div>
  );
}
