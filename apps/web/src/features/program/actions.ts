"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/server/auth";
import { parseActionError } from "@/lib/server/parse-action-error";
import { createCoreServices } from "@/lib/server/services";
import type { ProgramActionState } from "./types";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const kneeCheckSchema = z.object({
  checkinDate: isoDate,
  swelling: z.enum(["none", "trace", "1+", "2+"]),
  graftPain: z.coerce.number().int().min(0).max(10),
  extensionFull: z.enum(["yes", "no"]).transform((v) => v === "yes"),
});

function revalidateProgramViews() {
  revalidatePath("/dashboard");
  revalidatePath("/program");
  revalidatePath("/strength");
}

/** Morning knee check: three taps, saved into the day's recovery row. */
export async function logKneeCheckAction(
  _previous: ProgramActionState,
  formData: FormData,
): Promise<ProgramActionState> {
  try {
    const user = await requireCurrentUser();
    const parsed = kneeCheckSchema.parse({
      checkinDate: formData.get("checkinDate"),
      swelling: formData.get("swelling"),
      graftPain: formData.get("graftPain"),
      extensionFull: formData.get("extensionFull"),
    });
    const { programService } = await createCoreServices();
    await programService.saveKneeCheck({ userId: user.id, ...parsed });
    revalidateProgramViews();
    return {};
  } catch (error) {
    return parseActionError(error);
  }
}

const gateSchema = z.object({
  gateKey: z.string().regex(/^[a-z0-9_]{1,40}$/),
  clearedOn: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(isoDate.nullable()),
});

/** Settings: mark a gate cleared from a date, or clear it again. */
export async function setGateAction(
  _previous: ProgramActionState,
  formData: FormData,
): Promise<ProgramActionState> {
  try {
    const user = await requireCurrentUser();
    const intent = formData.get("intent");
    const parsed = gateSchema.parse({
      gateKey: formData.get("gateKey"),
      clearedOn:
        intent === "reset" ? "" : (formData.get("clearedOn") ?? undefined),
    });
    const { programService } = await createCoreServices();
    await programService.setGateCleared({ userId: user.id, ...parsed });
    revalidateProgramViews();
    revalidatePath("/settings");
    return {};
  } catch (error) {
    return parseActionError(error);
  }
}
