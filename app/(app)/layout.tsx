import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Server-side gate. The proxy also enforces this, but doing it in the
  // layout means a stale cookie is caught even if the matcher misses.
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // ThemeProvider lives in the root layout so the theme is global (the
  // profile menu's theme picker works on marketing pages too).
  return <AppShell user={user}>{children}</AppShell>;
}
