import { z } from "zod";

export const authActionStateSchema = z.object({
  error: z.string().optional(),
  fieldErrors: z.record(z.string(), z.string()).optional(),
});

export type AuthActionState = z.infer<typeof authActionStateSchema>;

const MAX_REDIRECT_LENGTH = 512;
const REDIRECT_RESOLUTION_BASE = "https://redirect-guard.invalid";

/**
 * Reduces a caller-supplied `redirectTo` to a same-origin path, or falls back
 * to the dashboard.
 *
 * This used to be a `/^\/(?!\/)/` regex, which blocked `//evil.com` but not
 * `/\evil.com` — browsers normalize a backslash to a forward slash when
 * resolving a `Location` on an http(s) URL, so that form resolved to
 * `https://evil.com/` and passed the check. Since the value reaches `redirect()`
 * right after a successful login, the victim landed on an attacker's site
 * immediately after authenticating on the real domain: a strong phishing
 * primitive.
 *
 * Resolving against a throwaway base and comparing origins is checked by the
 * same URL parser the browser uses, so it can't disagree with the browser
 * about what a given string means.
 */
export function sanitizeRedirectTo(value: string | null | undefined) {
  if (!value || value.length > MAX_REDIRECT_LENGTH) {
    return "/dashboard";
  }

  let resolved: URL;
  try {
    resolved = new URL(value, REDIRECT_RESOLUTION_BASE);
  } catch {
    return "/dashboard";
  }

  if (resolved.origin !== REDIRECT_RESOLUTION_BASE) {
    return "/dashboard";
  }

  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

export function mapAuthErrorMessage(message: string) {
  if (message.includes("Invalid login credentials")) {
    return "Invalid email or password.";
  }

  if (message.includes("Email not confirmed")) {
    return "Check your inbox and confirm your email before logging in.";
  }

  if (message.includes("User already registered")) {
    return "An account with this email already exists. Try logging in instead.";
  }

  if (message.includes("Password should be at least")) {
    return "Password must be at least 8 characters.";
  }

  return message;
}
