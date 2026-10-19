import type {
  IsoDate,
  KneeCheck,
  ProgramSessionOutcome,
  ProgramWeeklyCheckin,
  TrainingProgram,
  TrainingSetting,
  UserId,
} from "@fitness-app/domain";
import { z } from "zod";
import { isoDateSchema, uuidSchema } from "../../shared/primitives";

export const setGateClearedSchema = z.object({
  userId: uuidSchema,
  gateKey: z.string().regex(/^[a-z0-9_]{1,40}$/),
  clearedOn: isoDateSchema.nullable(),
});

export type SetGateClearedInput = z.infer<typeof setGateClearedSchema>;

export const saveKneeCheckSchema = z.object({
  userId: uuidSchema,
  checkinDate: isoDateSchema,
  swelling: z.enum(["none", "trace", "1+", "2+"]),
  graftPain: z.number().int().min(0).max(10),
  extensionFull: z.boolean(),
});

export type SaveKneeCheckInput = z.infer<typeof saveKneeCheckSchema>;

export type DatedKneeCheck = KneeCheck & { date: IsoDate };

export const SKIP_REASONS = [
  "time",
  "knee",
  "sick",
  "travel",
  "other",
] as const;
export const RED_FLAG_REASONS = [
  "giving_way",
  "locking",
  "sharp_pain",
] as const;

export const saveOutcomeSchema = z.discriminatedUnion("outcome", [
  z.object({
    userId: uuidSchema,
    programSessionId: uuidSchema,
    date: isoDateSchema,
    outcome: z.literal("skipped"),
    reason: z.enum(SKIP_REASONS),
    notes: z.string().trim().max(500).nullable().optional(),
  }),
  z.object({
    userId: uuidSchema,
    programSessionId: uuidSchema,
    date: isoDateSchema,
    outcome: z.literal("stopped"),
    reason: z.enum(RED_FLAG_REASONS),
    notes: z.string().trim().max(500).nullable().optional(),
  }),
]);

export type SaveOutcomeInput = z.infer<typeof saveOutcomeSchema>;

export const clearOutcomeSchema = z.object({
  userId: uuidSchema,
  programSessionId: uuidSchema,
  date: isoDateSchema,
});

export type ClearOutcomeInput = z.infer<typeof clearOutcomeSchema>;

export const updateSettingSchema = z.object({
  userId: uuidSchema,
  key: z.string().regex(/^[a-z0-9_]{1,60}$/),
  value: z.number().min(-100000).max(100000).nullable(),
  textValue: z.string().trim().max(200).nullable(),
});

export type UpdateSettingInput = z.infer<typeof updateSettingSchema>;

export const saveWeeklyCheckinSchema = z
  .object({
    userId: uuidSchema,
    weekStart: isoDateSchema,
    ptVisitsScheduled: z.number().int().min(0).max(14).nullable(),
    ptVisitsAttended: z.number().int().min(0).max(14).nullable(),
    quadLsiPct: z.number().min(0).max(200).nullable(),
    walkingAsymmetryPct: z.number().min(0).max(100).nullable(),
    notes: z.string().trim().max(1000).nullable(),
  })
  .refine(
    (v) =>
      v.ptVisitsAttended == null ||
      v.ptVisitsScheduled == null ||
      v.ptVisitsAttended <= v.ptVisitsScheduled,
    {
      message: "Attended can't be more than scheduled.",
      path: ["ptVisitsAttended"],
    },
  );

export type SaveWeeklyCheckinInput = z.infer<typeof saveWeeklyCheckinSchema>;

export interface ProgramRepository {
  /** The active program with blocks, weeks, sessions, exercises and gates. */
  getActiveProgram(userId: UserId): Promise<TrainingProgram | null>;
  setGateCleared(input: SetGateClearedInput): Promise<void>;
  /** Knee checks saved on recovery rows between two dates (inclusive). */
  listKneeChecks(
    userId: UserId,
    startDate: IsoDate,
    endDate: IsoDate,
  ): Promise<DatedKneeCheck[]>;
  /** Saves into the day's recovery row, creating it when missing. */
  saveKneeCheck(input: SaveKneeCheckInput): Promise<void>;
  listOutcomes(
    userId: UserId,
    startDate: IsoDate,
    endDate: IsoDate,
  ): Promise<ProgramSessionOutcome[]>;
  /** One outcome per session and date; saving again replaces it. */
  saveOutcome(input: SaveOutcomeInput): Promise<void>;
  clearOutcome(input: ClearOutcomeInput): Promise<void>;
  listSettings(userId: UserId): Promise<TrainingSetting[]>;
  updateSetting(input: UpdateSettingInput): Promise<void>;
  listWeeklyCheckins(
    userId: UserId,
    fromWeekStart: IsoDate,
    toWeekStart: IsoDate,
  ): Promise<ProgramWeeklyCheckin[]>;
  saveWeeklyCheckin(input: SaveWeeklyCheckinInput): Promise<void>;
}

export class ProgramService {
  constructor(private readonly repository: ProgramRepository) {}

  async getActiveProgram(userId: UserId) {
    return this.repository.getActiveProgram(uuidSchema.parse(userId));
  }

  async setGateCleared(input: unknown) {
    return this.repository.setGateCleared(setGateClearedSchema.parse(input));
  }

  async listKneeChecks(userId: UserId, startDate: IsoDate, endDate: IsoDate) {
    return this.repository.listKneeChecks(userId, startDate, endDate);
  }

  async saveKneeCheck(input: unknown) {
    return this.repository.saveKneeCheck(saveKneeCheckSchema.parse(input));
  }

  async listOutcomes(userId: UserId, startDate: IsoDate, endDate: IsoDate) {
    return this.repository.listOutcomes(userId, startDate, endDate);
  }

  async saveOutcome(input: unknown) {
    return this.repository.saveOutcome(saveOutcomeSchema.parse(input));
  }

  async clearOutcome(input: unknown) {
    return this.repository.clearOutcome(clearOutcomeSchema.parse(input));
  }

  async listSettings(userId: UserId) {
    return this.repository.listSettings(userId);
  }

  async updateSetting(input: unknown) {
    return this.repository.updateSetting(updateSettingSchema.parse(input));
  }

  async listWeeklyCheckins(
    userId: UserId,
    fromWeekStart: IsoDate,
    toWeekStart: IsoDate,
  ) {
    return this.repository.listWeeklyCheckins(
      userId,
      fromWeekStart,
      toWeekStart,
    );
  }

  async saveWeeklyCheckin(input: unknown) {
    return this.repository.saveWeeklyCheckin(
      saveWeeklyCheckinSchema.parse(input),
    );
  }
}
