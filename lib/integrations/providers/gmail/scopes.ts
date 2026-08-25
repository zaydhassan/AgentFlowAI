import "server-only";

export const GMAIL_SCOPES = {
  modify: "https://www.googleapis.com/auth/gmail.modify",
  readonly: "https://www.googleapis.com/auth/gmail.readonly",
  send: "https://www.googleapis.com/auth/gmail.send",
  labels: "https://www.googleapis.com/auth/gmail.labels",
  metadata: "https://www.googleapis.com/auth/gmail.metadata",
} as const;

/** Default scope set requested on connect/reconnect. */
export const GMAIL_DEFAULT_SCOPES: readonly string[] = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  GMAIL_SCOPES.modify,
];

// Google OAuth + Gmail endpoints.
export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

// Env var names for the dedicated Gmail OAuth client (separate from login).
export const GMAIL_CLIENT_ID_ENV = "GMAIL_OAUTH_CLIENT_ID";
export const GMAIL_CLIENT_SECRET_ENV = "GMAIL_OAUTH_CLIENT_SECRET";
export const GMAIL_REDIRECT_URI_ENV = "GMAIL_OAUTH_REDIRECT_URI";