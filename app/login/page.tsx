import Link from "next/link";
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
      subtitle="Sign in to your AgentFlow workspace."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-brand hover:underline">Sign up free</Link>
        </>
      }
    >
      <LoginFormSection providers={providers} />
    </AuthLayout>
  );
}
