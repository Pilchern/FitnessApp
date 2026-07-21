import "server-only";

import { requireCurrentUser } from "@/lib/server/auth";
import { createCoreServices } from "@/lib/server/services";
import type { SettingsPageData } from "./types";

export async function getSettingsPageData(): Promise<SettingsPageData> {
  const user = await requireCurrentUser();
  const { profileService, supplementService } = await createCoreServices();
  const profile = await profileService.getByUserId(user.id);

  if (!profile) {
    throw new Error("User profile not found. Please refresh the page.");
  }

  const supplements = await supplementService.listAll({ userId: user.id });

  return {
    profile,
    userEmail: user.email ?? "",
    supplements,
  };
}
