// @vitest-environment node
import { describe, expect, it } from "vitest";
import { limitRequestBody } from "@/server";

/**
 * Mimic srvx (the Node adapter behind `vite dev`/preview): it builds the real
 * Request lazily, so reading metadata such as `redirect` after the body stream
 * was consumed throws. This is what turned admin uploads into HTTP 500s.
 */
function lazyAdapterRequest(body: BodyInit, headers: Record<string, string> = {}): Request {
  const inner = new Request("http://localhost/api/admin/images", { method: "POST", body, headers });
  return new Proxy(inner, {
    get(target, property) {
      if (property === "redirect" && target.bodyUsed) {
        throw new TypeError("Response body object should not be disturbed or locked");
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

describe("limitRequestBody", () => {
  it("re-creates a bounded request without touching metadata after reading the body", async () => {
    const form = new FormData();
    form.set("profileId", "ammu");
    form.set("file", new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }), "t.png");
    const encoded = new Request("http://localhost", { method: "POST", body: form });
    const result = await limitRequestBody(
      lazyAdapterRequest(await encoded.arrayBuffer(), {
        "content-type": encoded.headers.get("content-type") ?? "",
      }),
      1024 * 1024,
    );

    expect(result).toBeInstanceOf(Request);
    const parsed = await (result as Request).formData();
    expect(parsed.get("profileId")).toBe("ammu");
    expect((parsed.get("file") as File).size).toBe(4);
  });

  it("rejects bodies that exceed the limit while streaming", async () => {
    const result = await limitRequestBody(lazyAdapterRequest(new Uint8Array(32)), 16);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(413);
  });
});
