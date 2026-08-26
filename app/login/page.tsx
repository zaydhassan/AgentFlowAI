import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginFormSection } from "@/components/auth/login-form";

export default function LoginPage() {
  // Server-rendered flags so the buttons render in the correct enabled state
  // without a round-trip to /api/auth/providers.
  const providers = {
    google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
    github: Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET),
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue building autonomous AI workflows."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-brand hover:underline">Sign up free</Link>
        </>
      }
    >
      <LoginFormSection providers={providers} />
      <p className="mt-5 flex items-center justify-center gap-2 text-center text-[11px] text-fg-subtle">
        <Icon name="ShieldCheck" className="h-3 w-3 text-success" />
        Secure authentication · Your data stays private · Ready in seconds
      </p>
    </AuthLayout>
  );
}
