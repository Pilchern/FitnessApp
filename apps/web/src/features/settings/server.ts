import "server-only";

import { SupplementService, UserProfileService } from "@fitness-app/application";
import {
  SupabaseSupplementRepository,
  SupabaseUserProfileRepository,
} from "@fitness-app/infrastructure";
import { requireCurrentUser } from "@/lib/server/auth";
import { createSupabaseRequestClient } from "@/lib/server/supabase";
import type { SettingsPageData } from "./types";

async function createProfileService() {
  const client = await createSupabaseRequestClient();
  return new UserProfileService(new SupabaseUserProfileRepository(client));
}

async function createSupplementService() {
  const client = await createSupabaseRequestClient();
  return new SupplementService(new SupabaseSupplementRepository(client));
}

export async function getSettingsPageData(): Promise<SettingsPageData> {
  const user = await requireCurrentUser();
  const profileService = await createProfileService();
  const profile = await profileService.getByUserId(user.id);

  if (!profile) {
    throw new Error("User profile not found. Please refresh the page.");
  }

  const supplementService = await createSupplementService();
  const supplements = await supplementService.listAll({ userId: user.id });

  return {
    profile,
    userEmail: user.email ?? "",
    supplements,
  };
}
