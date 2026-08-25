import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Icon } from "@/components/ui/icon";
import { verifyEmailAction } from "@/actions/auth";
import { auth } from "@/auth";
import { PendingCard } from "@/components/auth/pending-card";
import { ResendForm } from "@/components/auth/resend-form";

async function VerifyWithToken({ token }: { token: string }) {
  const result = await verifyEmailAction(token);
  if (result?.ok) {
    redirect("/dashboard");
  }
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-danger/10 text-danger">
        <Icon name="XCircle" className="h-6 w-6" />
      </div>
      <p className="text-sm text-fg-muted">{result?.message ?? "This verification link is invalid."}</p>
      <Link
        href="/login"
        className="inline-flex h-10 items-center justify-center rounded-lg bg-gradient-to-r from-brand to-ai px-5 text-sm font-medium text-white"
      >
        Back to sign in
      </Link>
    </div>
  );
}

export default async function VerifyEmailPage(props: {
  searchParams: Promise<{ token?: string; pending?: string; email?: string }>;
}) {
  const sp = await props.searchParams;
  const session = await auth();
  if (!session?.user?.id && !sp.pending) {
    // Anyone can hit this page; redirect to login if they're not signed in
    // and didn't just sign up.
    redirect("/login");
  }
  const initialEmail = sp.email ?? session?.user?.email ?? "";

  return (
    <AuthLayout title="" subtitle="">
      <Suspense fallback={null}>
        {sp.token ? (
          <VerifyWithToken token={sp.token} />
        ) : sp.pending ? (
          <PendingCard />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-fg-muted">
              Enter your email and we&rsquo;ll send a new verification link.
            </p>
            <ResendForm initialEmail={initialEmail} />
          </div>
        )}
      </Suspense>
    </AuthLayout>
  );
}
