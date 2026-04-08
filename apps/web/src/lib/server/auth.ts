import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseRequestClient } from "./supabase";

// cache() deduplicates this call within a single request render tree.
// layout.tsx + any page component both call requireCurrentUser — this ensures
// only one supabase.auth.getUser() network call happens per request.
export const getCurrentUser = cache(async function getCurrentUser() {
  const supabase = await createSupabaseRequestClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return user;
});

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
