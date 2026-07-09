// All "use server" entry points for the auth flows. Called by the client
// forms via useActionState. Each action returns a typed AuthFormState so the
// client can render field-level or page-level errors.

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { sendEmail } from "@/lib/resend";
import {
  emailVerificationEmail,
  passwordResetEmail,
} from "@/lib/email/templates";
import {
  createEmailVerificationToken,
  createPasswordResetToken,
} from "@/lib/auth/tokens";
import {
  SignupSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  type AuthFormState,
} from "@/lib/validation/auth";
import { signIn } from "@/auth";

// Re-export so client components can import the type from "@/actions/auth".
export type { AuthFormState } from "@/lib/validation/auth";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 50) || `ws-${randomBytes(3).toString("hex")}`;
}

async function uniqueOrgSlug(base: string): Promise<string> {
  let slug = base;
  let i = 0;
  while (await prisma.organization.findUnique({ where: { slug } })) {
    i += 1;
    slug = `${base}-${i}`;
  }
  return slug;
}

// -----------------------------------------------------------------------------
// Signup
// -----------------------------------------------------------------------------

export async function signupAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    workspace: String(formData.get("workspace") ?? ""),
  };
  const parsed = SignupSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "Please fix the highlighted fields.",
    };
  }
  const { name, email, password, workspace } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      ok: false,
      fieldErrors: { email: ["An account with that email already exists."] },
      message: "Email already exists.",
    };
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
    },
    select: { id: true, name: true, email: true },
  });

  // Default org
  const orgName = (workspace && workspace.trim()) || `${name}'s workspace`;
  const slug = await uniqueOrgSlug(slugify(orgName));
  const org = await prisma.organization.create({
    data: {
      name: orgName,
      slug,
      ownerId: user.id,
      plan: "free",
      memberships: {
        create: { userId: user.id, role: "owner" },
      },
    },
  });

  // Default Free subscription row
  await prisma.subscription.create({
    data: {
      userId: user.id,
      stripeCustomerId: `pending_${user.id}`, // replaced when they buy a plan
      plan: "free",
      status: "active",
    },
  });

  // Send verification email (best-effort; do not block signup if it fails)
  try {
    const token = await createEmailVerificationToken(user.email);
    const tmpl = emailVerificationEmail({ name: user.name, token });
    await sendEmail({
      to: user.email,
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
    });
  } catch (err) {
    console.error("verification email failed", err);
  }

  // Sign the user in immediately. Auth.js signIn() will throw a redirect
  // Navigation signal; we let it bubble so Next.js performs the navigation.
  await signIn("credentials", {
    email,
    password,
    redirect: false,
  });

  // Send the client to the verify-email screen.
  redirect("/verify-email?pending=1");
}

// -----------------------------------------------------------------------------
// Login (wraps the Auth.js credentials provider for use in server actions
// — the client can also call signIn("credentials", { redirect: false }) via
// the useSession-aware client signIn helper).
// -----------------------------------------------------------------------------

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = LoginSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "Please fix the highlighted fields.",
    };
  }
  const { email, password } = parsed.data;

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch {
    return { ok: false, message: "Incorrect email or password." };
  }

  revalidatePath("/", "layout");
  // Land on the marketing landing first; its CTA adapts to signed-in users
  // ("Open the dashboard"), so they enter the app from there.
  redirect("/");
}

// -----------------------------------------------------------------------------
// Forgot password
// -----------------------------------------------------------------------------

export async function forgotPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = ForgotPasswordSchema.safeParse({
    email: String(formData.get("email") ?? ""),
  });
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "Please enter a valid email address.",
    };
  }
  const { email } = parsed.data;

  // Always return ok — never reveal whether an email is registered.
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    try {
      const token = await createPasswordResetToken(email);
      const tmpl = passwordResetEmail({ name: user.name, token });
      await sendEmail({
        to: email,
        subject: tmpl.subject,
        html: tmpl.html,
        text: tmpl.text,
      });
    } catch (err) {
      console.error("reset email failed", err);
    }
  }
  return {
    ok: true,
    message:
      "If an account exists for that email, we've sent a password reset link. Check your inbox.",
  };
}

// -----------------------------------------------------------------------------
// Reset password
// -----------------------------------------------------------------------------

export async function resetPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = ResetPasswordSchema.safeParse({
    token: String(formData.get("token") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "Please fix the highlighted fields.",
    };
  }
  const { token, password } = parsed.data;

  // The token was issued for an email. Look it up via the VerificationToken
  // table; we encode the email in the token by using a random ID.
  // Here we look up by token alone (token is unique in the table).
  const record = await prisma.verificationToken.findUnique({
    where: { token },
  });
  if (!record) {
    return { ok: false, message: "This reset link is invalid or has expired." };
  }
  if (record.expires.getTime() < Date.now()) {
    await prisma.verificationToken.delete({ where: { token } });
    return { ok: false, message: "This reset link is invalid or has expired." };
  }
  // record.identifier is "reset:<email>"
  if (!record.identifier.startsWith("reset:")) {
    return { ok: false, message: "Invalid reset token." };
  }
  const email = record.identifier.slice("reset:".length);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { ok: false, message: "Account no longer exists." };
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { email }, data: { passwordHash } });
  await prisma.verificationToken.delete({ where: { token } });

  // Auto sign-in.
  await signIn("credentials", { email, password, redirect: false });
  redirect("/dashboard");
}

// -----------------------------------------------------------------------------
// Verify email
// -----------------------------------------------------------------------------

export async function verifyEmailAction(token: string): Promise<AuthFormState> {
  if (!token) {
    return { ok: false, message: "Missing verification token." };
  }
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record) {
    return { ok: false, message: "This verification link is invalid." };
  }
  if (record.expires.getTime() < Date.now()) {
    await prisma.verificationToken.delete({ where: { token } });
    return { ok: false, message: "This verification link has expired." };
  }

  await prisma.user.update({
    where: { email: record.identifier },
    data: { emailVerified: new Date() },
  });
  await prisma.verificationToken.delete({ where: { token } });
  return { ok: true, message: "Email verified. You're all set.", redirectTo: "/dashboard" };
}

export async function resendVerificationAction(email: string): Promise<AuthFormState> {
  if (!email) return { ok: false, message: "Missing email." };
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Don't leak
    return { ok: true, message: "If that account exists, a new link has been sent." };
  }
  if (user.emailVerified) {
    return { ok: true, message: "Your email is already verified." };
  }
  try {
    const token = await createEmailVerificationToken(email);
    const tmpl = emailVerificationEmail({ name: user.name, token });
    await sendEmail({
      to: email,
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
    });
  } catch (err) {
    console.error("resend verification failed", err);
    return { ok: false, message: "We couldn't send the email. Please try again." };
  }
  return { ok: true, message: "A new verification link is on its way." };
}
