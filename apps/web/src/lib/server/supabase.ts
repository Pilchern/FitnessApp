import "server-only";
import { cache } from "react";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServerEnv } from "./env";

type CookieRecord = {
  name: string;
  value: string;
};

type CookieStore = {
  getAll: () => CookieRecord[];
  setAll?: (cookies: Array<CookieRecord & { options?: CookieOptions }>) => void;
};

type SettableCookie = CookieRecord & { options?: CookieOptions };

export function createSupabaseServerClient(cookieStore: CookieStore) {
  const serverEnv = getServerEnv();

  return createServerClient(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: SettableCookie[]) {
          cookieStore.setAll?.(cookiesToSet);
        },
      },
    },
  );
}

// cache() deduplicates this within a single request render tree.
// All services (layout, page, feature modules) share one Supabase client per request.
export const createSupabaseRequestClient = cache(async function createSupabaseRequestClient() {
  const cookieStore = await cookies();

  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      } catch {
        // Server components cannot always mutate cookies. Middleware handles refresh persistence.
      }
    },
  });
});

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
