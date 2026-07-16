import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { verifyAppleHealthRequest } from "./verify-request";

const SECRET = "test-secret-value";
const BODY = JSON.stringify({ date: "2026-07-16", steps: 1000 });

function makeRequest(headers: Record<string, string>) {
  return new NextRequest("https://example.com/api/integrations/apple-health/daily-metrics", {
    method: "POST",
    headers,
  });
}

function signHmac(userId: string, timestamp: number, body: string) {
  return createHmac("sha256", SECRET).update(`${userId}.${timestamp}.${body}`).digest("hex");
}

describe("verifyAppleHealthRequest", () => {
  it("accepts a valid bearer token", () => {
    const request = makeRequest({
      Authorization: `Bearer ${SECRET}`,
      "X-User-Id": "user-1",
    });
    const result = verifyAppleHealthRequest(request, BODY, SECRET);
    expect(result).toEqual({ ok: true, userId: "user-1" });
  });

  it("accepts a bearer token without the 'Bearer ' prefix", () => {
    const request = makeRequest({
      Authorization: SECRET,
      "X-User-Id": "user-1",
    });
    const result = verifyAppleHealthRequest(request, BODY, SECRET);
    expect(result.ok).toBe(true);
  });

  it("rejects an incorrect bearer token", () => {
    const request = makeRequest({
      Authorization: "Bearer wrong-secret",
      "X-User-Id": "user-1",
    });
    const result = verifyAppleHealthRequest(request, BODY, SECRET);
    expect(result).toEqual({ ok: false, status: 401, error: "Invalid bearer token." });
  });

  it("rejects a request with no X-User-Id at all", () => {
    const request = makeRequest({ Authorization: `Bearer ${SECRET}` });
    const result = verifyAppleHealthRequest(request, BODY, SECRET);
    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Missing X-User-Id header.",
    });
  });

  it("accepts a valid HMAC signature", () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signHmac("user-1", timestamp, BODY);
    const request = makeRequest({
      "X-User-Id": "user-1",
      "X-Timestamp": String(timestamp),
      "X-Signature": `sha256=${signature}`,
    });
    const result = verifyAppleHealthRequest(request, BODY, SECRET);
    expect(result).toEqual({ ok: true, userId: "user-1" });
  });

  it("rejects an HMAC signature computed with the wrong secret", () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const wrongSignature = createHmac("sha256", "not-the-secret")
      .update(`user-1.${timestamp}.${BODY}`)
      .digest("hex");
    const request = makeRequest({
      "X-User-Id": "user-1",
      "X-Timestamp": String(timestamp),
      "X-Signature": `sha256=${wrongSignature}`,
    });
    const result = verifyAppleHealthRequest(request, BODY, SECRET);
    expect(result).toEqual({ ok: false, status: 401, error: "Invalid signature." });
  });

  it("rejects a timestamp outside the replay window", () => {
    const staleTimestamp = Math.floor(Date.now() / 1000) - 3600;
    const signature = signHmac("user-1", staleTimestamp, BODY);
    const request = makeRequest({
      "X-User-Id": "user-1",
      "X-Timestamp": String(staleTimestamp),
      "X-Signature": `sha256=${signature}`,
    });
    const result = verifyAppleHealthRequest(request, BODY, SECRET);
    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Timestamp outside replay window.",
    });
  });

  it("rejects a request with neither bearer nor HMAC headers", () => {
    const request = makeRequest({ "X-User-Id": "user-1" });
    const result = verifyAppleHealthRequest(request, BODY, SECRET);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
    }
  });
});
