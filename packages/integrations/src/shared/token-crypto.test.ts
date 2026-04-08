import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, isTokenExpired } from "./token-crypto";

const key = Buffer.alloc(32, 1).toString("base64");

describe("token crypto", () => {
  it("round-trips encrypted secrets", () => {
    const encrypted = encryptSecret("sensitive-token", key);
    expect(decryptSecret(encrypted, key)).toBe("sensitive-token");
  });

  it("detects malformed keys", () => {
    expect(() => encryptSecret("value", "short-key")).toThrow(
      "INTEGRATION_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
    );
  });

  it("evaluates token expiry thresholds safely", () => {
    expect(isTokenExpired(new Date(Date.now() - 5_000).toISOString())).toBe(true);
    expect(isTokenExpired(new Date(Date.now() + 60_000 * 10).toISOString())).toBe(
      false,
    );
  });
});
