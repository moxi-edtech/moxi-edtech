import type { FiscalCapability, FiscalConnection, FiscalEnvironment, FiscalProvider, FiscalProviderCode, FiscalTenantContext } from "./types";

export type FiscalResolutionErrorCode =
  | "CONNECTION_DISABLED" | "TENANT_MISMATCH" | "ENVIRONMENT_MISMATCH"
  | "PRODUCTION_DISABLED" | "PROVIDER_UNAVAILABLE" | "CAPABILITY_UNSUPPORTED"
  | "DUPLICATE_PROVIDER" | "CONNECTION_MISMATCH";

export class FiscalResolutionError extends Error {
  constructor(readonly code: FiscalResolutionErrorCode) {
    super(code);
    this.name = "FiscalResolutionError";
  }
}

/** A connection must be loaded from trusted server-side storage, never the request body.
 * Foundation deliberately denies ALL production resolution until a separate rollout.
 */
export class FiscalProviderRegistry {
  private readonly providers = new Map<FiscalProviderCode, FiscalProvider>();

  constructor(providers: readonly FiscalProvider[]) {
    for (const provider of providers) {
      if (this.providers.has(provider.code)) throw new FiscalResolutionError("DUPLICATE_PROVIDER");
      this.providers.set(provider.code, provider);
    }
  }

  resolve(input: {
    readonly empresaId: string;
    readonly connectionId: string;
    readonly environment: FiscalEnvironment;
    readonly connection: FiscalConnection;
    readonly capability: FiscalCapability;
  }): { readonly provider: FiscalProvider; readonly context: FiscalTenantContext } {
    const { connection, empresaId, connectionId, environment, capability } = input;
    if (!empresaId || empresaId !== connection.empresaId) throw new FiscalResolutionError("TENANT_MISMATCH");
    if (!connectionId || connectionId !== connection.connectionId) throw new FiscalResolutionError("CONNECTION_MISMATCH");
    if (environment !== connection.environment) throw new FiscalResolutionError("ENVIRONMENT_MISMATCH");
    if (connection.status !== "active") throw new FiscalResolutionError("CONNECTION_DISABLED");
    if (environment !== "sandbox") throw new FiscalResolutionError("PRODUCTION_DISABLED");
    const provider = this.providers.get(connection.providerCode);
    if (!provider || !provider.environments.includes(environment)) throw new FiscalResolutionError("PROVIDER_UNAVAILABLE");
    if (!provider.capabilities.includes(capability)) throw new FiscalResolutionError("CAPABILITY_UNSUPPORTED");
    return { provider, context: { empresaId, connectionId, environment } };
  }
}
