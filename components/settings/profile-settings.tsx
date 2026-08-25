"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

function initials(name?: string | null, email?: string | null): string {
  const src = (name && name.trim()) || (email ? email.split("@")[0] : "") || "?";
  return src
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}

export function ProfileSettings() {
  const { data: session, update } = useSession();
  const router = useRouter();

  const [name, setName] = useState(session?.user?.name ?? "");
  const [imageUrl, setImageUrl] = useState(session?.user?.image ?? null);

  useEffect(() => {
    // Re-sync the editable form fields when the session loads/updates from the
    // auth provider — an external system sync, not a render cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (session?.user?.name !== undefined) setName(session.user.name ?? "");
    if (session?.user?.image !== undefined) setImageUrl(session.user.image);
  }, [session?.user?.name, session?.user?.image]);

  const [savingName, setSavingName] = useState(false);

  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    fetch("/api/user/password", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setHasPassword(Boolean(d.hasPassword)))
      .catch(() => setHasPassword(true));
  }, []);

  async function refreshSurfaces() {
    // Refresh the JWT (so useSession consumers see the new name/photo) and the
    // server-rendered layout (topbar / user menu) without a full reload.
    await update({});
    router.refresh();
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be 2 MB or smaller.");
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/user/avatar", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Upload failed.");
        return;
      }
      setImageUrl(data.image);
      await refreshSurfaces();
      toast.success("Profile photo updated.");
    } catch {
      toast.error("Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onRemovePhoto() {
    setUploading(true);
    try {
      const res = await fetch("/api/user/avatar", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not remove photo.");
        return;
      }
      setImageUrl(null);
      await refreshSurfaces();
      toast.success("Profile photo removed.");
    } finally {
      setUploading(false);
    }
  }

  async function onSaveName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error("Name must be at least 2 characters.");
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not save name.");
        return;
      }
      setName(data.user?.name ?? trimmed);
      await refreshSurfaces();
      toast.success("Profile updated.");
    } finally {
      setSavingName(false);
    }
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 12) {
      toast.error("New password must be at least 12 characters.");
      return;
    }
    if (next !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setSavingPw(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: current || undefined,
          newPassword: next,
          confirm,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not change password.");
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setHasPassword(true);
      toast.success("Password changed.");
    } finally {
      setSavingPw(false);
    }
  }

  const nameUnchanged = name.trim() === (session?.user?.name ?? "");

  return (
    <div className="space-y-6">
      {/* Profile photo */}
      <Card>
        <CardHeader>
          <CardTitle>Profile photo</CardTitle>
          <CardDescription>
            Shown in the top bar and on your profile. JPEG, PNG, or WebP up to 2 MB.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-5">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-brand to-ai text-xl font-semibold text-white">
            {imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={imageUrl} alt="" className="h-20 w-20 object-cover" />
            ) : (
              initials(session?.user?.name, session?.user?.email)
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onPickFile}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Icon
                name={uploading ? "LoaderCircle" : "Upload"}
                className={cn("h-3.5 w-3.5", uploading && "animate-spin")}
              />
              {uploading ? "Uploading…" : "Change photo"}
            </Button>
            {imageUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={uploading}
                onClick={onRemovePhoto}
                className="text-danger hover:text-danger"
              >
                Remove
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Profile info */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your display name and email address.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSaveName} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-fg-muted">Display name</span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="Your name"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-fg-muted">Email</span>
              <Input value={session?.user?.email ?? ""} disabled className="opacity-70" />
              <span className="mt-1 block text-[10px] text-fg-subtle">Email is tied to your account identity and can’t be changed here.</span>
            </label>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={savingName || nameUnchanged}>
                <Icon
                  name={savingName ? "LoaderCircle" : "Check"}
                  className={cn("h-3.5 w-3.5", savingName && "animate-spin")}
                />
                {savingName ? "Saving…" : "Save name"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            {hasPassword === false
              ? "Set a password to sign in with your email."
              : "Use a strong password (at least 12 characters, with a letter and a number)."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasPassword === false && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-surface-2/40 p-3 text-xs text-fg-muted">
              <Icon name="Info" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-subtle" />
              <span>
                You currently sign in with an OAuth provider. Set a password below to also sign in
                with your email.
              </span>
            </div>
          )}
          <form onSubmit={onChangePassword} className="space-y-4">
            {hasPassword && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-fg-muted">Current password</span>
                <Input
                  type="password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
            )}
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-fg-muted">New password</span>
              <Input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
                placeholder="At least 12 characters"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-fg-muted">Confirm new password</span>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={savingPw || !next || !confirm}>
                <Icon
                  name={savingPw ? "LoaderCircle" : "Lock"}
                  className={cn("h-3.5 w-3.5", savingPw && "animate-spin")}
                />
                {savingPw ? "Updating…" : "Update password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}