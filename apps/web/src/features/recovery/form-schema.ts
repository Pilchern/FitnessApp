import { z } from "zod";
import { optionalString, parseOptionalNumber } from "@/lib/form-utils";

export const recoveryCheckinFormSchema = z.object({
  id: optionalString,
  checkinDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sleepHours: parseOptionalNumber(z.number().min(0).max(24), "Sleep hours"),
  sleepQuality: parseOptionalNumber(z.number().int().min(1).max(5), "Sleep quality"),
  readinessLevel: parseOptionalNumber(z.number().int().min(1).max(10), "Readiness"),
  energyLevel: parseOptionalNumber(z.number().int().min(1).max(10), "Energy"),
  stressLevel: parseOptionalNumber(z.number().int().min(1).max(10), "Stress"),
  sorenessLevel: parseOptionalNumber(z.number().int().min(1).max(10), "Soreness"),
  alcoholCount: parseOptionalNumber(z.number().int().min(0).max(20), "Alcohol count").transform(
    (value) => value ?? 0,
  ),
  restingHeartRate: parseOptionalNumber(z.number().int().min(0), "Resting heart rate"),
  hrv: parseOptionalNumber(z.number().min(0), "HRV"),
  notes: optionalString,
});

export type RecoveryCheckinFormInput = z.infer<typeof recoveryCheckinFormSchema>;
