import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "./supabase";

export type OwnerUser = {
  id: string;
  email: string | null;
  user_metadata: { display_name?: string };
};

// Single-user app, no login. The owner is the one profile row; on a fresh
// database it falls back to the first auth user. cache() dedupes per request.
export const getCurrentUser = cache(
  async function getCurrentUser(): Promise<OwnerUser | null> {
    const admin = createSupabaseAdminClient();

    const { data: profile } = await admin
      .from("profiles")
      .select("user_id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (profile?.user_id) {
      return { id: profile.user_id, email: null, user_metadata: {} };
    }

    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    const first = data?.users[0];

    return first
      ? {
          id: first.id,
          email: first.email ?? null,
          user_metadata: {},
        }
      : null;
  },
);

export async function requireCurrentUser(): Promise<OwnerUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error(
      "No owner user found. Create one auth user in Supabase to bootstrap.",
    );
  }

  return user;
}
