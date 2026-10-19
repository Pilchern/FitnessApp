import type {
  IsoDate,
  KneeCheck,
  TrainingProgram,
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
}
