import { z } from "zod";

const n = (min: number, max: number) => z.number().min(min).max(max).nullable();
const trials = (count: number, max: number) => z.array(n(0, max)).max(count);
const perLeg = (count: number, max: number) =>
  z.object({ L: trials(count, max), R: trials(count, max) });
const pair = (min: number, max: number) =>
  z.object({ L: n(min, max), R: n(min, max) });

/** The knee test entry as the form posts it (JSON in one hidden field). */
export const kneeTestEntrySchema = z.object({
  testDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the test date"),
  angleDeg: z.number().int().min(30).max(120),
  strapNote: z.string().trim().max(200).nullable(),
  quadWarmup: perLeg(2, 3000),
  quad: perLeg(3, 3000),
  ham: perLeg(3, 3000),
  flexionActive: n(0, 170),
  flexionPassive: n(0, 170),
  extension: n(-20, 30),
  kneeGirth: pair(10, 100),
  thighGirth: pair(10, 120),
  heelHeight: n(-5, 30),
  sitToStand: pair(0, 100),
  heelToButt: pair(0, 80),
  stepDownLeftClean: z.boolean().nullable(),
  walkingAsymmetry: n(0, 100),
  walkingSpeed: n(0, 5),
  steps: n(0, 100000),
  effusionGrade: z.number().int().min(0).max(4).nullable(),
  aclRsi: n(0, 100),
  hops: z.object({
    single: perLeg(3, 400),
    triple: perLeg(3, 1200),
    crossover: perLeg(3, 1200),
    timed6m: perLeg(3, 30),
  }),
  notes: z.string().trim().max(300).nullable(),
});

export function readKneeTestForm(formData: FormData) {
  const raw = formData.get("entry");
  let parsed: unknown;
  try {
    parsed = JSON.parse(typeof raw === "string" ? raw : "");
  } catch {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        message: "The test could not be read. Please try again.",
        path: ["entry"],
      },
    ]);
  }
  return kneeTestEntrySchema.parse(parsed);
}

export const clinicVisitSchema = z.object({
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the visit date"),
  provider: z.string().trim().max(100).nullable(),
  flexionActive: n(0, 170),
  flexionPassive: n(0, 170),
  extension: n(-20, 30),
  mmt: z.string().trim().max(20).nullable(),
  lefs: n(0, 80),
  lefsMax: z.number().int().min(1).max(80),
  notes: z.string().trim().max(400).nullable(),
});

export function readClinicVisitForm(formData: FormData) {
  const raw = formData.get("visit");
  let parsed: unknown;
  try {
    parsed = JSON.parse(typeof raw === "string" ? raw : "");
  } catch {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        message: "The visit could not be read. Please try again.",
        path: ["visit"],
      },
    ]);
  }
  return clinicVisitSchema.parse(parsed);
}
