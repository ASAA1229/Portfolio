import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildEnvelope,
  enqueueEvent,
  eventsSummary,
  flushEvents,
  resetEventsTokenCache,
  resolveEventsConfig,
} from "@/lib/asaa-events";
import { safeFailureReason } from "@/lib/admin-sso";
import { MemoryR2 } from "./helpers/memory-r2";

// E2:D6.10 - secrets never reach logs or responses.
const SECRET = "client-secret-SENTINEL-9f3a";
const TOKEN = "access-token-SENTINEL-77c1";
const CONFIG = {
  ASAA_EVENTS_URL: "http://127.0.0.1:8101",
  ASAA_ORG_ID: "org-123",
  ASAA_EVENTS_TOKEN_URL: "http://127.0.0.1:8080/token",
  ASAA_EVENTS_CLIENT_SECRET: SECRET,
};

let logged: string[];
beforeEach(() => {
  resetEventsTokenCache();
  logged = [];
  for (const level of ["error", "warn", "info", "log"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(
        args
          .map((a) => (a instanceof Error ? `${a.message}${a.stack}` : JSON.stringify(a)))
          .join(" "),
      );
    });
  }
});
afterEach(() => vi.restoreAllMocks());

describe("safeFailureReason", () => {
  it("never echoes provider response text that a JSON parse error quotes", () => {
    let error: unknown;
    try {
      JSON.parse(`{"id_token":"${TOKEN}", broken`);
    } catch (caught) {
      error = caught;
    }
    expect(safeFailureReason(error)).toBe("invalid_response");
    expect(safeFailureReason(new Error(`boom ${TOKEN}`))).toBe("unexpected");
    expect(safeFailureReason(new Error("HTTP 401"))).toBe("HTTP 401");
  });
});

describe("ASAA event delivery", () => {
  it("never logs the client secret or tokens, and failed deliveries clear the token and keep the event", async () => {
    const config = resolveEventsConfig(CONFIG)!;
    const r2 = new MemoryR2();
    await enqueueEvent(
      r2,
      buildEnvelope(config, { type: "portfolio.admin.login", severity: "info", data: {} }),
    );
    const fetchFn = (async (url: string) => {
      if (String(url).includes("/token"))
        return Response.json({ access_token: TOKEN, expires_in: 300 });
      throw new Error(`network down for Bearer ${TOKEN} using ${SECRET}`);
    }) as unknown as typeof fetch;
    const result = await flushEvents(r2, config, { fetchFn });
    expect(result.pending).toBe(1);
    const summary = await eventsSummary(r2, config);
    expect(summary).toMatchObject({ enabled: true, pending: 1, retrying: 1, deadLettered: 0 });
    expect(JSON.stringify(summary)).not.toContain(SECRET);
    for (const line of logged) {
      expect(line).not.toContain(SECRET);
      expect(line).not.toContain(TOKEN);
    }
  });

  it("reports a permanently rejected event as dead-lettered without exposing it", async () => {
    const config = resolveEventsConfig({
      ...CONFIG,
      ASAA_EVENTS_TOKEN_URL: undefined,
      ASAA_EVENTS_CLIENT_SECRET: undefined,
      ASAA_EVENTS_TOKEN: TOKEN,
    })!;
    const r2 = new MemoryR2();
    await enqueueEvent(
      r2,
      buildEnvelope(config, { type: "portfolio.admin.login", severity: "info", data: {} }),
    );
    const fetchFn = (async () => new Response("bad", { status: 422 })) as unknown as typeof fetch;
    await flushEvents(r2, config, { fetchFn });
    const summary = await eventsSummary(r2, config);
    expect(summary).toMatchObject({ pending: 0, deadLettered: 1 });
    expect(JSON.stringify(summary)).not.toContain(TOKEN);
  });

  it("is disabled without configuration", async () => {
    expect(await eventsSummary(new MemoryR2(), null)).toMatchObject({
      enabled: false,
      state: "disabled",
    });
  });
});
