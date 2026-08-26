import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import {
  MAX_WEBHOOK_BODY_BYTES,
  readBoundedWebhookBody,
} from "./read-bounded-body";

function makeRequest(body: string, headers: Record<string, string> = {}) {
  return new NextRequest(
    "https://example.com/api/integrations/apple-health/sleep",
    { method: "POST", headers, body },
  );
}

describe("readBoundedWebhookBody", () => {
  it("returns the body when it is within the limit", async () => {
    const result = await readBoundedWebhookBody(
      makeRequest(JSON.stringify({ date: "2026-08-10" })),
    );

    expect(result).toEqual({
      ok: true,
      rawBody: JSON.stringify({ date: "2026-08-10" }),
    });
  });

  it("rejects on a declared Content-Length over the limit without reading the body", async () => {
    const result = await readBoundedWebhookBody(
      makeRequest("{}", {
        "content-length": String(MAX_WEBHOOK_BODY_BYTES + 1),
      }),
    );

    expect(result).toMatchObject({ ok: false, status: 413 });
  });

  it("rejects an oversized body even when Content-Length is absent or lies", async () => {
    // Content-Length is client-supplied and absent entirely on a chunked
    // request, so the actual byte length has to be checked too.
    const oversized = "a".repeat(MAX_WEBHOOK_BODY_BYTES + 1);

    const result = await readBoundedWebhookBody(
      makeRequest(oversized, { "content-length": "2" }),
    );

    expect(result).toMatchObject({ ok: false, status: 413 });
  });

  it("measures bytes rather than characters", async () => {
    // A multi-byte character body just under the limit in characters is over
    // it in bytes; String.length would let it through.
    const multibyte = "é".repeat(MAX_WEBHOOK_BODY_BYTES - 10);

    const result = await readBoundedWebhookBody(makeRequest(multibyte));

    expect(result).toMatchObject({ ok: false, status: 413 });
  });

  it("accepts a body exactly at the limit", async () => {
    const exact = "a".repeat(MAX_WEBHOOK_BODY_BYTES);

    const result = await readBoundedWebhookBody(makeRequest(exact));

    expect(result.ok).toBe(true);
  });
});
