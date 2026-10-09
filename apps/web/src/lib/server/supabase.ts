import "server-only";
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { getServerEnv } from "./env";

// Single-user app with no login: every request runs as the owner through the
// service-role client (RLS bypassed). Access control is "nobody has the URL".
export function createSupabaseAdminClient() {
  const serverEnv = getServerEnv();

  return createServerClient(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    },
  );
}

// cache() deduplicates this within a single request render tree.
export const createSupabaseRequestClient = cache(
  async function createSupabaseRequestClient() {
    return createSupabaseAdminClient();
  },
);
