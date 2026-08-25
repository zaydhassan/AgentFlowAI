import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { encryptToken, decryptToken } from "./crypto";
import type {
  IntegrationAccount,
  StoredIntegrationAccount,
  AccountStatus,
  IntegrationProviderId,
  TokenSet,
  UserProfile,
} from "./types";

type AccountRow = Awaited<ReturnType<typeof prisma.integrationAccount.findUnique>>;

interface CreateAccountInput {
  ownerId: string;
  orgId: string | null;
  provider: IntegrationProviderId;
  providerAccountId: string;
  profile: UserProfile;
  scopes: string[];
  tokenSet: TokenSet;
  /** When reconnecting an existing account, its id (preserves history/watermark). */
  existingId?: string;
}

function metaOf(row: AccountRow): { name: string | null; picture: string | null } {
  if (row && row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)) {
    const m = row.metadata as Record<string, unknown>;
    return {
      name: typeof m.name === "string" ? m.name : null,
      picture: typeof m.picture === "string" ? m.picture : null,
    };
  }
  return { name: null, picture: null };
}

/** Decrypt tokens into the server-only in-memory shape. */
function toStored(row: NonNullable<AccountRow>): StoredIntegrationAccount {
  const { name, picture } = metaOf(row);
  return {
    id: row.id,
    ownerId: row.ownerId,
    orgId: row.orgId,
    provider: row.provider as IntegrationProviderId,
    providerAccountId: row.providerAccountId,
    email: row.email,
    label: row.label,
    scopes: row.scopes,
    accessToken: decryptToken(row.accessToken),
    refreshToken: row.refreshToken ? decryptToken(row.refreshToken) : null,
    expiresAt: row.expiresAt,
    status: row.status as AccountStatus,
    name,
    picture,
    lastPollHistoryId: row.lastPollHistoryId,
  };
}

/** Client-safe shape — no tokens, ISO dates. */
function toClient(row: NonNullable<AccountRow>): IntegrationAccount {
  const { name, picture } = metaOf(row);
  return {
    id: row.id,
    ownerId: row.ownerId,
    orgId: row.orgId,
    provider: row.provider as IntegrationProviderId,
    providerAccountId: row.providerAccountId,
    email: row.email,
    label: row.label,
    scopes: row.scopes,
    status: row.status as AccountStatus,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    connectedAt: row.createdAt.toISOString(),
    name,
    picture,
  };
}

export const repository = {
  /** Create or update (reconnect) an account, encrypting tokens. Returns safe shape. */
  async upsertAccount(input: CreateAccountInput): Promise<IntegrationAccount> {
    const encryptedAccess = encryptToken(input.tokenSet.access_token);
    // A fresh connect/reconnect always yields a refresh_token (we request
    // access_type=offline + prompt=consent). On a background refresh the
    // response omits it — but that path uses updateTokens(), not here.
    const encryptedRefresh = input.tokenSet.refresh_token
      ? encryptToken(input.tokenSet.refresh_token)
      : null;

    const expiresAt = new Date(input.tokenSet.expires_at);
    const metadata: Prisma.JsonObject = {
      name: input.profile.name,
      picture: input.profile.picture,
    };

    // Upsert by the (ownerId, provider, providerAccountId) uniqueness key.
    const where = {
      ownerId_provider_providerAccountId: {
        ownerId: input.ownerId,
        provider: input.provider,
        providerAccountId: input.providerAccountId,
      },
    };

    const row = await prisma.integrationAccount.upsert({
      where,
      create: {
        ownerId: input.ownerId,
        orgId: input.orgId,
        provider: input.provider,
        providerAccountId: input.providerAccountId,
        email: input.profile.email,
        label: input.profile.email ?? input.profile.name ?? input.providerAccountId,
        scopes: input.scopes,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh ?? (() => {
          throw new Error(
            "Google did not return a refresh token. Re-grant consent — the reconnect flow forces prompt=consent.",
          );
        })(),
        expiresAt,
        status: "active",
        metadata,
      },
      update: {
        // Reconnect / re-grant: refresh everything, keep the row id + watermark.
        email: input.profile.email ?? undefined,
        label: input.profile.email ?? input.profile.name ?? undefined,
        scopes: input.scopes,
        accessToken: encryptedAccess,
        ...(encryptedRefresh ? { refreshToken: encryptedRefresh } : {}),
        expiresAt,
        status: "active",
        metadata,
      },
    });
    return toClient(row);
  },

  /** Persist a refreshed token set (re-encrypt). Keeps the existing refresh token
   *  if the response omitted a new one (Google does this after the first grant). */
  async updateTokens(id: string, tokenSet: TokenSet): Promise<void> {
    const encryptedAccess = encryptToken(tokenSet.access_token);
    await prisma.integrationAccount.update({
      where: { id },
      data: {
        accessToken: encryptedAccess,
        ...(tokenSet.refresh_token ? { refreshToken: encryptToken(tokenSet.refresh_token) } : {}),
        expiresAt: new Date(tokenSet.expires_at),
        status: "active",
      },
    });
  },

  /** List a user's connected accounts in the client-safe shape. */
  async listClientAccounts(ownerId: string, provider?: IntegrationProviderId): Promise<IntegrationAccount[]> {
    const rows = await prisma.integrationAccount.findMany({
      where: provider ? { ownerId, provider } : { ownerId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toClient);
  },

  /** Count a user's connected accounts (for the providers summary). */
  async countAccounts(ownerId: string, provider?: IntegrationProviderId): Promise<number> {
    return prisma.integrationAccount.count({ where: provider ? { ownerId, provider } : { ownerId } });
  },

  /** Decrypt an account for server-side use. Returns null if not found. */
  async getStored(id: string): Promise<StoredIntegrationAccount | null> {
    const row = await prisma.integrationAccount.findUnique({ where: { id } });
    return row ? toStored(row) : null;
  },

  /** Ownership-checked decrypt: returns the account only if `ownerId` owns it. */
  async getStoredOwned(ownerId: string, id: string): Promise<StoredIntegrationAccount | null> {
    const row = await prisma.integrationAccount.findUnique({ where: { id } });
    if (!row || row.ownerId !== ownerId) return null;
    return toStored(row);
  },

  async setStatus(id: string, status: AccountStatus): Promise<void> {
    await prisma.integrationAccount.update({ where: { id }, data: { status } });
  },

  async deleteAccount(id: string): Promise<void> {
    await prisma.integrationAccount.delete({ where: { id } });
  },

  /** Persist the Gmail historyId watermark used by the New Email polling trigger. */
  async updateWatermark(id: string, historyId: string | null): Promise<void> {
    await prisma.integrationAccount.update({ where: { id }, data: { lastPollHistoryId: historyId } });
  },
};