import type { UserProfile } from "@fitness-app/domain";
import type {
  UpdateUserProfileInput,
  UserProfileRepository,
} from "@fitness-app/application";
import { z } from "zod";
import {
  type AppSupabaseClient,
  compactRecord,
  requireSingleResult,
  throwOnError,
} from "./shared";

const PROFILE_SELECT =
  "id, user_id, display_name, timezone, units_system, week_starts_on, goal_fat_loss, goal_preserve_muscle, goal_improve_vo2, daily_protein_grams_target, daily_calories_target, daily_fiber_grams_target, created_at, updated_at";

const userProfileRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  display_name: z.string(),
  timezone: z.string(),
  units_system: z.enum(["imperial", "metric"]),
  week_starts_on: z.union([z.literal(0), z.literal(1)]),
  goal_fat_loss: z.boolean(),
  goal_preserve_muscle: z.boolean(),
  goal_improve_vo2: z.boolean(),
  daily_protein_grams_target: z.number().int().positive().nullable(),
  daily_calories_target: z.number().int().positive().nullable(),
  daily_fiber_grams_target: z.number().int().positive().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

type UserProfileRow = z.infer<typeof userProfileRowSchema>;

function mapUserProfileRow(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    timezone: row.timezone,
    unitsSystem: row.units_system,
    weekStartsOn: row.week_starts_on,
    goalFatLoss: row.goal_fat_loss,
    goalPreserveMuscle: row.goal_preserve_muscle,
    goalImproveVo2: row.goal_improve_vo2,
    dailyProteinGramsTarget: row.daily_protein_grams_target,
    dailyCaloriesTarget: row.daily_calories_target,
    dailyFiberGramsTarget: row.daily_fiber_grams_target,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toUserProfileUpdate(input: UpdateUserProfileInput) {
  return compactRecord({
    display_name: input.displayName,
    timezone: input.timezone,
    units_system: input.unitsSystem,
    week_starts_on: input.weekStartsOn,
    goal_fat_loss: input.goalFatLoss,
    goal_preserve_muscle: input.goalPreserveMuscle,
    goal_improve_vo2: input.goalImproveVo2,
    daily_protein_grams_target: input.dailyProteinGramsTarget,
    daily_calories_target: input.dailyCaloriesTarget,
    daily_fiber_grams_target: input.dailyFiberGramsTarget,
  });
}

export class SupabaseUserProfileRepository implements UserProfileRepository {
  constructor(private readonly client: AppSupabaseClient) {}

  async findByUserId(userId: string): Promise<UserProfile | null> {
    const response = await this.client
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("user_id", userId)
      .maybeSingle();

    throwOnError(response.error, "Fetch user profile");

    return response.data
      ? mapUserProfileRow(userProfileRowSchema.parse(response.data))
      : null;
  }

  async update(input: UpdateUserProfileInput): Promise<UserProfile> {
    const response = await this.client
      .from("profiles")
      .update(toUserProfileUpdate(input))
      .eq("user_id", input.userId)
      .select(PROFILE_SELECT)
      .single();

    return mapUserProfileRow(
      userProfileRowSchema.parse(
        requireSingleResult(response, "Update user profile"),
      ),
    );
  }
}
