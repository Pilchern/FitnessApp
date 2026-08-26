import type { CookieOptions } from "@supabase/ssr";

/**
 * Cookie options for the Supabase auth session cookies.
 *
 * `@supabase/ssr` defaults to `httpOnly: false` with no `secure` flag, because
 * its default assumption is that a browser-side Supabase client needs to read
 * the session. That assumption does not hold here: this app is server
 * components and server actions throughout, and `createSupabaseBrowserClient`
 * is defined but never called. Nothing in the browser needs cookie access.
 *
 * Left at the default, the access token *and* a 400-day refresh token for an
 * account holding journal entries, sleep, HRV, and resting heart rate are
 * readable by any script on the page — an XSS, a compromised browser
 * extension, or an injected third-party script.
 *
 * If a browser-side Supabase client is ever genuinely needed, the fix is to
 * proxy auth through the server, not to relax this.
 */
export const AUTH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  // Allowed off only for local http development; every deployed origin is https.
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};
