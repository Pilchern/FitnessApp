"use server";

import { NutritionTargetService, UserProfileService } from "@fitness-app/application";
import {
  SupabaseBodyMetricRepository,
  SupabaseUserProfileRepository,
} from "@fitness-app/infrastructure";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/server/auth";
import { parseActionError } from "@/lib/server/parse-action-error";
import { createSupabaseRequestClient } from "@/lib/server/supabase";
import { settingsFormSchema } from "./form-schema";
import type { NutritionTargets } from "@fitness-app/application";
import type { SettingsActionState } from "./types";

async function createProfileService() {
  const client = await createSupabaseRequestClient();
  return new UserProfileService(new SupabaseUserProfileRepository(client));
}

function buildProfilePayload(userId: string, formData: FormData) {
  const parsed = settingsFormSchema.parse({
    displayName: formData.get("displayName"),
    timezone: formData.get("timezone"),
    unitsSystem: formData.get("unitsSystem"),
    weekStartsOn: formData.get("weekStartsOn"),
    // Checkboxes are absent from FormData when unchecked — map to boolean
    goalFatLoss: formData.get("goalFatLoss") === "on",
    goalPreserveMuscle: formData.get("goalPreserveMuscle") === "on",
    goalImproveVo2: formData.get("goalImproveVo2") === "on",
    // Number inputs — empty string means "no target set"; null (absent field) treated as empty
    dailyProteinGramsTarget: formData.get("dailyProteinGramsTarget") ?? undefined,
    dailyCaloriesTarget: formData.get("dailyCaloriesTarget") ?? undefined,
    dailyFiberGramsTarget: formData.get("dailyFiberGramsTarget") ?? undefined,
  });

  return {
    userId,
    ...parsed,
  };
}

export async function updateSettingsAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  try {
    const user = await requireCurrentUser();
    const profileService = await createProfileService();
    await profileService.update(buildProfilePayload(user.id, formData));
    redirect("/settings?saved=true");
  } catch (error) {
    return parseActionError(error);
  }
}

export async function recomputeNutritionTargetsAction(): Promise<{
  error?: string;
  targets?: NutritionTargets;
}> {
  try {
    const user = await requireCurrentUser();
    const client = await createSupabaseRequestClient();
    const profileRepository = new SupabaseUserProfileRepository(client);
    const service = new NutritionTargetService(
      profileRepository,
      new SupabaseBodyMetricRepository(client),
    );
    const targets = await service.computeNutritionTargets(user.id);
    const profileService = new UserProfileService(profileRepository);
    const profile = await profileService.getByUserId(user.id);
    if (!profile) {
      return { error: "Profile not found" };
    }
    await profileService.update({
      userId: user.id,
      displayName: profile.displayName,
      timezone: profile.timezone,
      unitsSystem: profile.unitsSystem,
      weekStartsOn: profile.weekStartsOn,
      goalFatLoss: profile.goalFatLoss,
      goalPreserveMuscle: profile.goalPreserveMuscle,
      goalImproveVo2: profile.goalImproveVo2,
      dailyProteinGramsTarget: targets.dailyProteinGramsTarget,
      dailyCaloriesTarget: targets.dailyCaloriesTarget,
      dailyFiberGramsTarget: targets.dailyFiberGramsTarget,
    });
    return { targets };
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: "Something went wrong. Please try again." };
  }
}
