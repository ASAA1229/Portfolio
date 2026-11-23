import { beforeEach, describe, expect, it } from "vitest";
import {
  buildEnvelope,
  enqueueEvent,
  flushEvents,
  resetEventsTokenCache,
  resolveEventsConfig,
} from "@/lib/asaa-events";
import { MemoryR2 } from "./helpers/memory-r2";

const BASE = {
  ASAA_EVENTS_URL: "http://127.0.0.1:8101",
  ASAA_ORG_ID: "org-123",
};
const CC = {
  ASAA_EVENTS_TOKEN_URL: "http://127.0.0.1:8080/realms/x/protocol/openid-connect/token",
  ASAA_EVENTS_CLIENT_SECRET: "test-secret-not-real",
};

beforeEach(() => resetEventsTokenCache());

describe("client-credentials configuration", () => {
  it("defaults the client id and wins over the static token", () => {
    const config = resolveEventsConfig({ ...BASE, ...CC, ASAA_EVENTS_TOKEN: "static" });
    expect(config?.credentials?.clientId).toBe("portfolio-events");
  });
  it("a half-configured set disables delivery instead of using the static token", () => {
    expect(
      resolveEventsConfig({ ...BASE, ASAA_EVENTS_TOKEN: "s", ASAA_EVENTS_CLIENT_SECRET: "x" }),
    ).toBeNull();
    expect(
      resolveEventsConfig({
        ...BASE,
        ASAA_EVENTS_TOKEN: "s",
        ASAA_EVENTS_TOKEN_URL: CC.ASAA_EVENTS_TOKEN_URL,
      }),
    ).toBeNull();
  });
  it("rejects an insecure token URL", () => {
    expect(
      resolveEventsConfig({ ...BASE, ...CC, ASAA_EVENTS_TOKEN_URL: "http://idp.example.test/t" }),
    ).toBeNull();
  });
  it("static token alone still works", () => {
    expect(resolveEventsConfig({ ...BASE, ASAA_EVENTS_TOKEN: "s" })?.token).toBe("s");
  });
});

describe("client-credentials delivery", () => {
  it("fetches once, caches the token and sends it as the bearer", async () => {
    const config = resolveEventsConfig({ ...BASE, ...CC })!;
    const r2 = new MemoryR2();
    for (let i = 0; i < 2; i += 1) {
      await enqueueEvent(
        r2,
        buildEnvelope(config, { type: "portfolio.admin.login", severity: "info", data: {} }),
      );
    }
    let tokenCalls = 0;
    const auth: (string | null)[] = [];
    const fetchFn = (async (url: string, init: RequestInit) => {
      if (String(url).includes("openid-connect")) {
        tokenCalls += 1;
        expect(String(init.body)).toContain("grant_type=client_credentials");
        return Response.json({ access_token: "svc-token", expires_in: 300 });
      }
      auth.push(new Headers(init.headers).get("authorization"));
      return new Response(null, { status: 201 });
    }) as unknown as typeof fetch;
    await flushEvents(r2, config, { fetchFn });
    expect(tokenCalls).toBe(1);
    expect(auth).toEqual(["Bearer svc-token", "Bearer svc-token"]);
  });
  it("keeps events queued when the token endpoint fails", async () => {
    const config = resolveEventsConfig({ ...BASE, ...CC, ASAA_EVENTS_TOKEN: "static" })!;
    const r2 = new MemoryR2();
    await enqueueEvent(
      r2,
      buildEnvelope(config, { type: "portfolio.admin.login", severity: "info", data: {} }),
    );
    const calls: string[] = [];
    const fetchFn = (async (url: string) => {
      calls.push(String(url));
      return new Response("no", { status: 401 });
    }) as unknown as typeof fetch;
    const result = await flushEvents(r2, config, { fetchFn });
    expect(result.delivered).toBe(0);
    expect(result.pending).toBe(1);
    expect(calls.every((c) => c.includes("openid-connect"))).toBe(true);
  });
});
