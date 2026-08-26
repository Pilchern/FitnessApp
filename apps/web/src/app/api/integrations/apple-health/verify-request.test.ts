import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import type { AppleHealthSecretLookup } from "./verify-request";
import { verifyAppleHealthRequest } from "./verify-request";

const USER_ONE_SECRET = "user-1-webhook-token";
const USER_TWO_SECRET = "user-2-webhook-token";
const BODY = JSON.stringify({ date: "2026-07-16", steps: 1000 });

// In-memory per-user secret store, standing in for the real
// `createAppleHealthWebhookSecretLookup()` (which reads
// `integration_connection_credentials` via Supabase) per this codebase's
// convention of mocking repository lookups rather than hitting real
// Supabase in unit tests (see AGENTS.md, QA and Testing Agent section).
const SECRETS_BY_USER: Record<string, string> = {
  "user-1": USER_ONE_SECRET,
  "user-2": USER_TWO_SECRET,
};

const lookupSecret: AppleHealthSecretLookup = async (userId: string) =>
  SECRETS_BY_USER[userId] ?? null;

function makeRequest(headers: Record<string, string>) {
  return new NextRequest(
    "https://example.com/api/integrations/apple-health/daily-metrics",
    {
      method: "POST",
      headers,
    },
  );
}

function signHmac(
  secret: string,
  userId: string,
  timestamp: number,
  body: string,
) {
  return createHmac("sha256", secret)
    .update(`${userId}.${timestamp}.${body}`)
    .digest("hex");
}

describe("verifyAppleHealthRequest", () => {
  it("accepts a valid bearer token for the matching user", async () => {
    const request = makeRequest({
      Authorization: `Bearer ${USER_ONE_SECRET}`,
      "X-User-Id": "user-1",
    });
    const result = await verifyAppleHealthRequest(request, BODY, lookupSecret);
    expect(result).toEqual({ ok: true, userId: "user-1" });
  });

  it("accepts a bearer token without the 'Bearer ' prefix", async () => {
    const request = makeRequest({
      Authorization: USER_ONE_SECRET,
      "X-User-Id": "user-1",
    });
    const result = await verifyAppleHealthRequest(request, BODY, lookupSecret);
    expect(result.ok).toBe(true);
  });

  it("rejects an incorrect bearer token for a user that has a token configured", async () => {
    const request = makeRequest({
      Authorization: "Bearer wrong-secret",
      "X-User-Id": "user-1",
    });
    const result = await verifyAppleHealthRequest(request, BODY, lookupSecret);
    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Invalid bearer token.",
    });
  });

  it("rejects user 2's correct secret when claiming to be user 1 (cross-user forgery)", async () => {
    const request = makeRequest({
      Authorization: `Bearer ${USER_TWO_SECRET}`,
      "X-User-Id": "user-1",
    });
    const result = await verifyAppleHealthRequest(request, BODY, lookupSecret);
    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Invalid bearer token.",
    });
  });

  it("rejects user 1's correct secret when claiming to be user 2 (cross-user forgery, reversed)", async () => {
    const request = makeRequest({
      Authorization: `Bearer ${USER_ONE_SECRET}`,
      "X-User-Id": "user-2",
    });
    const result = await verifyAppleHealthRequest(request, BODY, lookupSecret);
    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Invalid bearer token.",
    });
  });

  it("rejects a request with no X-User-Id at all", async () => {
    const request = makeRequest({ Authorization: `Bearer ${USER_ONE_SECRET}` });
    const result = await verifyAppleHealthRequest(request, BODY, lookupSecret);
    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Missing X-User-Id header.",
    });
  });

  it("rejects a well-formed request for a user id that has no webhook token configured", async () => {
    const request = makeRequest({
      Authorization: "Bearer anything",
      "X-User-Id": "user-does-not-exist",
    });
    const result = await verifyAppleHealthRequest(request, BODY, lookupSecret);
    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "No Apple Health webhook token configured for this user.",
    });
  });

  it("fails cleanly when the secret lookup itself returns null (e.g. missing encryption key)", async () => {
    const alwaysNullLookup: AppleHealthSecretLookup = async () => null;
    const request = makeRequest({
      Authorization: `Bearer ${USER_ONE_SECRET}`,
      "X-User-Id": "user-1",
    });
    const result = await verifyAppleHealthRequest(
      request,
      BODY,
      alwaysNullLookup,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
    }
  });

  it("accepts a valid HMAC signature for the matching user", async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signHmac(USER_ONE_SECRET, "user-1", timestamp, BODY);
    const request = makeRequest({
      "X-User-Id": "user-1",
      "X-Timestamp": String(timestamp),
      "X-Signature": `sha256=${signature}`,
    });
    const result = await verifyAppleHealthRequest(request, BODY, lookupSecret);
    expect(result).toEqual({ ok: true, userId: "user-1" });
  });

  it("rejects an HMAC signature computed with the wrong secret", async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const wrongSignature = createHmac("sha256", "not-the-secret")
      .update(`user-1.${timestamp}.${BODY}`)
      .digest("hex");
    const request = makeRequest({
      "X-User-Id": "user-1",
      "X-Timestamp": String(timestamp),
      "X-Signature": `sha256=${wrongSignature}`,
    });
    const result = await verifyAppleHealthRequest(request, BODY, lookupSecret);
    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Invalid signature.",
    });
  });

  it("rejects an HMAC signature computed with another user's secret while claiming to be user 1", async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    // Signed correctly per user-2's own secret, but sent with X-User-Id: user-1.
    const signature = signHmac(USER_TWO_SECRET, "user-1", timestamp, BODY);
    const request = makeRequest({
      "X-User-Id": "user-1",
      "X-Timestamp": String(timestamp),
      "X-Signature": `sha256=${signature}`,
    });
    const result = await verifyAppleHealthRequest(request, BODY, lookupSecret);
    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Invalid signature.",
    });
  });

  it("rejects a timestamp outside the replay window", async () => {
    const staleTimestamp = Math.floor(Date.now() / 1000) - 3600;
    const signature = signHmac(USER_ONE_SECRET, "user-1", staleTimestamp, BODY);
    const request = makeRequest({
      "X-User-Id": "user-1",
      "X-Timestamp": String(staleTimestamp),
      "X-Signature": `sha256=${signature}`,
    });
    const result = await verifyAppleHealthRequest(request, BODY, lookupSecret);
    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Timestamp outside replay window.",
    });
  });

  it("rejects a request with neither bearer nor HMAC headers", async () => {
    const request = makeRequest({ "X-User-Id": "user-1" });
    const result = await verifyAppleHealthRequest(request, BODY, lookupSecret);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
    }
  });
});
