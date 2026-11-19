/**
 * ASAA ecosystem service manifest v1 (contracts/asaa-ecosystem/v1/service-manifest.schema.json).
 * Served unauthenticated at GET /.well-known/asaa-service. The output holds only status words and fixed
 * identifiers: never URLs, keys, secrets or provider names.
 */
export type CheckState = "ok" | "degraded" | "down" | "disabled";

export type ManifestEnvironment = "development" | "test" | "staging" | "production" | "local-prod";

export interface ServiceManifest {
  schema: "asaa.service-manifest.v1";
  service: "portfolio";
  project: "PORTFOLIO";
  version: string;
  commit: string | null;
  environment?: ManifestEnvironment;
  status: "ok" | "degraded" | "down";
  checkedAt: string;
  checks: Record<string, CheckState>;
  capabilities: string[];
  contracts: Record<string, string>;
}

const ENVIRONMENTS: readonly ManifestEnvironment[] = [
  "development",
  "test",
  "staging",
  "production",
  "local-prod",
];

export function parseManifestEnvironment(value: unknown): ManifestEnvironment | undefined {
  return typeof value === "string" ? ENVIRONMENTS.find((item) => item === value) : undefined;
}

/**
 * Overall status: storage is required for the Admin/CMS and published feeds, so "down" storage is
 * "degraded" (public pages still render from curated data). AI is optional: "disabled" or "down" AI
 * never degrades the service because the UI falls back to offline profile answers.
 */
export function buildServiceManifest(input: {
  version: string | undefined;
  commit: string | null | undefined;
  environment: unknown;
  storage: CheckState;
  ai: CheckState;
  /** Delivery health of ASAA events ("disabled" unless ASAA_EVENTS_* are configured). */
  asaaEvents?: CheckState;
  now?: Date;
}): ServiceManifest {
  const environment = parseManifestEnvironment(input.environment);
  return {
    schema: "asaa.service-manifest.v1",
    service: "portfolio",
    project: "PORTFOLIO",
    version: (input.version ?? "0.0.0").slice(0, 64),
    commit: input.commit && /^[0-9a-f]{7,40}$/.test(input.commit) ? input.commit : null,
    ...(environment ? { environment } : {}),
    status: input.storage === "ok" ? "ok" : "degraded",
    checkedAt: (input.now ?? new Date()).toISOString(),
    checks: {
      storage: input.storage,
      ai: input.ai,
      asaaEvents: input.asaaEvents ?? "disabled",
    },
    capabilities: ["portfolio.profiles", "portfolio.published-feeds", "ai.chat-consumer"],
    contracts: { serviceManifest: "v1" },
  };
}
