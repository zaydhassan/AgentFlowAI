const MESSAGES: Record<string, string> = {
  // Auth.js v5 built-in error codes
  Configuration:
    "Authentication is misconfigured. Please contact support if this persists.",
  AccessDenied: "Access denied. You don't have permission to sign in.",
  Verification:
    "That sign-in link is invalid or has expired. Please request a new one.",
  OAuthSignin: "Could not start the sign-in flow. Please try again.",
  OAuthCallback: "Something went wrong during the OAuth callback.",
  OAuthCreateAccount: "We couldn't create your account via OAuth. Please try again.",
  EmailCreateAccount: "We couldn't create your account with that email.",
  Callback: "Something went wrong in the sign-in callback.",
  OAuthAccountNotLinked:
    "An account with that email already exists. Please sign in with your original method.",
  EmailSignin: "We couldn't send the sign-in email. Please try again.",
  CredentialsSignin: "Incorrect email or password.",
  SessionRequired: "Please sign in to continue.",
  // Custom
  EmailExists: "An account with that email already exists. Try signing in instead.",
  EmailNotVerified:
    "Please verify your email address before signing in. Check your inbox.",
  RateLimited: "Too many attempts. Please wait a moment and try again.",
  Unknown: "Something unexpected went wrong. Please try again.",
};

export function friendlyAuthError(code?: string | null): string {
  if (!code) return MESSAGES.Unknown;
  return MESSAGES[code] ?? MESSAGES.Unknown;
}

export const FRIENDLY_OAUTH_ERRORS = {
  google: "Google sign-in failed. Please try again or use a different method.",
  github: "GitHub sign-in failed. Please try again or use a different method.",
  notConfigured:
    "OAuth is not configured on this environment. Set AUTH_GOOGLE_ID/SECRET and AUTH_GITHUB_ID/SECRET in your .env.",
  missing: "That sign-in method isn't available right now.",
};
