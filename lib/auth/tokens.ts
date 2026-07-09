// Email-verification and password-reset token helpers.
// Stores single-use, expiring tokens in the Auth.js VerificationToken table,
// which is the same table Auth.js uses for its magic-link flow.

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

const EMAIL_VERIFY_TTL_HOURS = 24;
const PASSWORD_RESET_TTL_MINUTES = 60;

function makeToken(): string {
  // 32 random bytes → ~43 char url-safe base64
  return randomBytes(32).toString("base64url");
}

export async function createEmailVerificationToken(identifier: string): Promise<string> {
  const token = makeToken();
  const expires = new Date(Date.now() + EMAIL_VERIFY_TTL_HOURS * 60 * 60 * 1000);
  // Replace any prior tokens for the same identifier.
  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({ data: { identifier, token, expires } });
  return token;
}

export async function consumeEmailVerificationToken(
  identifier: string,
  token: string,
): Promise<boolean> {
  const record = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier, token } },
  });
  if (!record) return false;
  if (record.expires.getTime() < Date.now()) {
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier, token } },
    });
    return false;
  }
  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier, token } },
  });
  return true;
}

export async function createPasswordResetToken(identifier: string): Promise<string> {
  const token = makeToken();
  const expires = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);
  // We reuse the same VerificationToken table with the email as identifier.
  await prisma.verificationToken.deleteMany({
    where: { identifier: `reset:${identifier}` },
  });
  await prisma.verificationToken.create({
    data: { identifier: `reset:${identifier}`, token, expires },
  });
  return token;
}

export async function consumePasswordResetToken(
  identifier: string,
  token: string,
): Promise<boolean> {
  return consumeEmailVerificationToken(`reset:${identifier}`, token);
}
