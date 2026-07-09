import Link from "next/link";
import { AuthLayout } from "@/components/auth/auth-layout";
import { SignupFormSection } from "@/components/auth/signup-form";

export default function SignupPage() {
  const providers = {
    google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
    github: Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET),
  };

  return (
    <AuthLayout
      title="Create your workspace"
      subtitle="Start free with 1,000 credits. No card required."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link>
        </>
      }
    >
      <SignupFormSection providers={providers} />
    </AuthLayout>
  );
}
