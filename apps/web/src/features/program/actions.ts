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

const outcomeSchema = z.object({
  programSessionId: z.string().uuid(),
  date: isoDate,
  outcome: z.enum(["skipped", "stopped"]),
  reason: z.string(),
});

/** An explicit skip (with a reason) or a red-flag stop for a planned session. */
export async function logSessionOutcomeAction(
  _previous: ProgramActionState,
  formData: FormData,
): Promise<ProgramActionState> {
  try {
    const user = await requireCurrentUser();
    const parsed = outcomeSchema.parse({
      programSessionId: formData.get("programSessionId"),
      date: formData.get("date"),
      outcome: formData.get("outcome"),
      reason: formData.get("reason"),
    });
    const { programService } = await createCoreServices();
    await programService.saveOutcome({ userId: user.id, ...parsed });
    revalidateProgramViews();
    return { saved: true };
  } catch (error) {
    return parseActionError(error);
  }
}

/** Undo a skip or stop logged by mistake. */
export async function clearSessionOutcomeAction(
  _previous: ProgramActionState,
  formData: FormData,
): Promise<ProgramActionState> {
  try {
    const user = await requireCurrentUser();
    const parsed = outcomeSchema
      .pick({ programSessionId: true, date: true })
      .parse({
        programSessionId: formData.get("programSessionId"),
        date: formData.get("date"),
      });
    const { programService } = await createCoreServices();
    await programService.clearOutcome({ userId: user.id, ...parsed });
    revalidateProgramViews();
    return {};
  } catch (error) {
    return parseActionError(error);
  }
}

const settingSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]{1,60}$/),
  kind: z.enum(["number", "text"]),
  value: z.string().optional(),
});

/** Settings: one target or threshold. Blank clears it (the default applies). */
export async function updateTrainingSettingAction(
  _previous: ProgramActionState,
  formData: FormData,
): Promise<ProgramActionState> {
  try {
    const user = await requireCurrentUser();
    const parsed = settingSchema.parse({
      key: formData.get("key"),
      kind: formData.get("kind"),
      value: formData.get("value") ?? undefined,
    });
    const raw = (parsed.value ?? "").trim();
    let value: number | null = null;
    let textValue: string | null = null;
    if (parsed.kind === "number") {
      if (raw !== "") {
        value = Number(raw);
        if (!Number.isFinite(value)) {
          return { fieldErrors: { value: "Enter a number." } };
        }
      }
    } else {
      textValue = raw === "" ? null : raw;
    }
    const { programService } = await createCoreServices();
    await programService.updateSetting({
      userId: user.id,
      key: parsed.key,
      value,
      textValue,
    });
    revalidateProgramViews();
    revalidatePath("/settings");
    return { saved: true };
  } catch (error) {
    return parseActionError(error);
  }
}
