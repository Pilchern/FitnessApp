import type { UserProfile, UserId } from "@fitness-app/domain";
import { z } from "zod";
import { isoDateSchema, uuidSchema } from "../../shared/primitives";

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
  targetWeightLb: z.number().positive().nullable().optional(),
  targetDate: isoDateSchema.nullable().optional(),
  // Bounds are data-entry sanity checks, matching the DB check constraints
  // added alongside these columns (TD-030). They are generous rather than
  // physiological: the point is to catch a typo or a unit mix-up, not to
  // adjudicate what a real body can be.
  heightCm: z.number().positive().max(300).nullable().optional(),
  birthDate: isoDateSchema.nullable().optional(),
  biologicalSex: z
    .enum(["male", "female", "unspecified"])
    .nullable()
    .optional(),
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
