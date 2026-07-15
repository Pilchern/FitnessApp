import { z } from "zod";
import { optionalString, parseOptionalNumber } from "@/lib/form-utils";

const optionalLocalTime = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : ""))
  .refine((value) => value === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(value), {
    message: "Use a 24-hour time like 22:45",
  })
  .transform((value) => (value === "" ? null : value));

const parseBooleanCheckbox = z
  .union([z.string(), z.undefined()])
  .transform((value) => value === "on");

export const recoveryCheckinFormSchema = z.object({
  id: optionalString,
  checkinDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sleepHours: parseOptionalNumber(z.number().min(0).max(24), "Sleep hours"),
  bedtimeLocal: optionalLocalTime,
  wakeTimeLocal: optionalLocalTime,
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
  coldPlungeCompleted: parseBooleanCheckbox,
  notes: optionalString,
});

export type RecoveryCheckinFormInput = z.infer<typeof recoveryCheckinFormSchema>;
