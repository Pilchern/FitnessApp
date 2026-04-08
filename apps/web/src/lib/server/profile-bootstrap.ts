import "server-only";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseRequestClient } from "./supabase";

const defaultBaselineSchedule = {
  monday: ["lift"],
  tuesday: ["zone2_peloton_45_60"],
  wednesday: ["lift"],
  thursday: ["vo2_peloton_30_40"],
  friday: ["lift"],
  saturday: ["long_zone2_peloton_45_75"],
  sunday: ["recovery"],
};

function fallbackDisplayName(user: User) {
  const explicitName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : "";

  if (explicitName) {
    return explicitName;
  }

  if (user.email) {
    return user.email.split("@")[0] ?? "Athlete";
  }

  return "Athlete";
}

// cache() deduplicates this per request — layout.tsx calls this on every
// protected render, so caching avoids a redundant SELECT per page navigation.
export const ensureProfileForUser = cache(async function ensureProfileForUser(
  user: User,
  timezone?: string,
) {
  const supabase = await createSupabaseRequestClient();

  const { data: existingProfile, error: fetchError } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Profile lookup failed: ${fetchError.message}`);
  }

  if (existingProfile) {
    return existingProfile;
  }

  const { data: createdProfile, error: insertError } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: user.id,
        display_name: fallbackDisplayName(user),
        timezone: timezone ?? "America/Chicago",
        units_system: "imperial",
        week_starts_on: 1,
        goal_fat_loss: true,
        goal_preserve_muscle: true,
        goal_improve_vo2: true,
        baseline_schedule: defaultBaselineSchedule,
      },
      {
        onConflict: "user_id",
      },
    )
    .select("id, display_name")
    .single();

  if (insertError) {
    throw new Error(`Profile bootstrap failed: ${insertError.message}`);
  }

  return createdProfile;
});
