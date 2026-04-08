import type { UserProfile, UserId } from "@fitness-app/domain";
import { z } from "zod";
import { uuidSchema } from "../../shared/primitives";

export const updateUserProfileSchema = z.object({
  userId: uuidSchema,
  displayName: z.string().trim().min(1, "Display name is required").max(100),
  timezone: z.string().min(1, "Timezone is required"),
  unitsSystem: z.enum(["imperial", "metric"]),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]),
  goalFatLoss: z.boolean(),
  goalPreserveMuscle: z.boolean(),
  goalImproveVo2: z.boolean(),
  dailyProteinGramsTarget: z.number().int().positive().nullable().optional(),
  dailyCaloriesTarget: z.number().int().positive().nullable().optional(),
  dailyFiberGramsTarget: z.number().int().positive().nullable().optional(),
});

export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;

export interface UserProfileRepository {
  findByUserId(userId: UserId): Promise<UserProfile | null>;
  update(input: UpdateUserProfileInput): Promise<UserProfile>;
}

export class UserProfileService {
  constructor(private readonly repository: UserProfileRepository) {}

  async getByUserId(userId: string): Promise<UserProfile | null> {
    return this.repository.findByUserId(userId);
  }

  async update(input: unknown): Promise<UserProfile> {
    return this.repository.update(updateUserProfileSchema.parse(input));
  }
}
