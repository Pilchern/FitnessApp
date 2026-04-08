import { describe, expect, it } from "vitest";
import { mapAuthErrorMessage, sanitizeRedirectTo } from "./auth";

describe("sanitizeRedirectTo", () => {
  it("allows internal application routes", () => {
    expect(sanitizeRedirectTo("/body")).toBe("/body");
    expect(sanitizeRedirectTo("/weekly-review?weekStart=2026-03-23")).toBe(
      "/weekly-review?weekStart=2026-03-23",
    );
  });

  it("falls back to the dashboard for unsafe redirects", () => {
    expect(sanitizeRedirectTo(undefined)).toBe("/dashboard");
    expect(sanitizeRedirectTo("https://example.com")).toBe("/dashboard");
    expect(sanitizeRedirectTo("//example.com")).toBe("/dashboard");
  });
});

describe("mapAuthErrorMessage", () => {
  it("normalizes Supabase auth errors into clearer copy", () => {
    expect(mapAuthErrorMessage("Invalid login credentials")).toBe(
      "Invalid email or password.",
    );
    expect(mapAuthErrorMessage("Email not confirmed")).toBe(
      "Check your inbox and confirm your email before logging in.",
    );
    expect(mapAuthErrorMessage("User already registered")).toBe(
      "An account with this email already exists. Try logging in instead.",
    );
  });

  it("passes through unknown errors", () => {
    expect(mapAuthErrorMessage("Something custom happened")).toBe(
      "Something custom happened",
    );
  });
});
