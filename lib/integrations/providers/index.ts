import "server-only";
import type { IntegrationProvider, IntegrationProviderId } from "../types";
import { GmailProvider } from "./gmail";

const providers: Record<IntegrationProviderId, IntegrationProvider> = {
  gmail: new GmailProvider(),
};

export function getProvider(id: string): IntegrationProvider | undefined {
  return providers[id as IntegrationProviderId];
}

export function allProviders(): IntegrationProvider[] {
  return Object.values(providers);
}