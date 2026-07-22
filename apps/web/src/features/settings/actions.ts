"use server";

import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/server/auth";
import { parseActionError } from "@/lib/server/parse-action-error";
import { createCoreServices } from "@/lib/server/services";
import {
  createSupabaseAdminClient,
  createSupabaseRequestClient,
} from "@/lib/server/supabase";
import {
  deleteAccountFormSchema,
  settingsFormSchema,
  supplementFormSchema,
} from "./form-schema";
import type { NutritionTargets } from "@fitness-app/application";
import type { SettingsActionState, SupplementActionState } from "./types";

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
    const { profileService } = await createCoreServices();
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
    const { nutritionTargetService, profileService } = await createCoreServices();
    const targets = await nutritionTargetService.computeNutritionTargets(user.id);
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

export async function createSupplementAction(
  _previousState: SupplementActionState,
  formData: FormData,
): Promise<SupplementActionState> {
  try {
    const user = await requireCurrentUser();
    const parsed = supplementFormSchema.parse({ name: formData.get("name") });
    const { supplementService } = await createCoreServices();
    await supplementService.create({ userId: user.id, name: parsed.name });
    redirect("/settings?saved=true");
  } catch (error) {
    return parseActionError(error);
  }
}

export async function deactivateSupplementAction(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    redirect("/settings");
  }

  let url = "/settings?saved=true";
  try {
    const user = await requireCurrentUser();
    const { supplementService } = await createCoreServices();
    await supplementService.archive(user.id, id);
  } catch (error) {
    url = `/settings?error=${encodeURIComponent(
      error instanceof Error ? error.message : "Could not deactivate supplement.",
    )}`;
  }
  redirect(url);
}

export async function reactivateSupplementAction(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    redirect("/settings");
  }

  let url = "/settings?saved=true";
  try {
    const user = await requireCurrentUser();
    const { supplementService } = await createCoreServices();
    await supplementService.update({ id, userId: user.id, isActive: true });
  } catch (error) {
    url = `/settings?error=${encodeURIComponent(
      error instanceof Error ? error.message : "Could not reactivate supplement.",
    )}`;
  }
  redirect(url);
}

/**
 * Permanently deletes the account and all associated data. Requires the
 * user to type "DELETE" as an explicit destructive-action confirmation
 * (TD-022). Deleting the auth.users row cascades every user-owned table via
 * existing `on delete cascade` foreign keys — no per-table cleanup needed.
 */
export async function deleteAccountAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  try {
    const user = await requireCurrentUser();
    const parsed = deleteAccountFormSchema.safeParse({
      confirmation: formData.get("confirmation"),
    });

    if (!parsed.success) {
      return { error: 'Type "DELETE" (all caps) to confirm account deletion.' };
    }

    const admin = createSupabaseAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);

    if (error) {
      return { error: "Could not delete your account. Please try again." };
    }

    const supabase = await createSupabaseRequestClient();
    await supabase.auth.signOut();
  } catch (error) {
    return parseActionError(error);
  }

  redirect(
    "/login?message=Your%20account%20and%20all%20data%20have%20been%20deleted.",
  );
}
