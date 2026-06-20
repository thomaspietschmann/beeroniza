// Centralised, typed access to environment configuration. Server-only.

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value !== "false" && value !== "0";
}

function int(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

// Fail loudly rather than silently signing sessions with a known default secret
// in production. Only fall back to a dev secret outside production.
function requireAuthSecret(): string {
  const value = process.env.AUTH_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET must be set in production (no insecure default is used).",
    );
  }
  return "dev-secret-change-me";
}

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  authSecret: requireAuthSecret(),
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  runWorker: bool(process.env.RUN_WORKER, true),
  workerConcurrency: int(process.env.WORKER_CONCURRENCY, 2),
  storageDriver: (process.env.STORAGE_DRIVER ?? "db") as "db" | "local",
  storageLocalPath: process.env.STORAGE_LOCAL_PATH ?? "/app/storage",
  allowRegistration: bool(process.env.ALLOW_REGISTRATION, true),
  port: int(process.env.PORT, 3000),
  isProduction: process.env.NODE_ENV === "production",
  // Generic OIDC provider (Keycloak, Authentik, Zitadel, …). Enabled only when
  // all three vars are set. The redirect URI to register:
  //   {APP_URL}/api/auth/callback/oidc
  oidcIssuer: process.env.OIDC_ISSUER ?? "",
  oidcClientId: process.env.OIDC_CLIENT_ID ?? "",
  oidcClientSecret: process.env.OIDC_CLIENT_SECRET ?? "",
  oidcName: process.env.OIDC_NAME ?? "SSO",
};

export type AppEnv = typeof env;
