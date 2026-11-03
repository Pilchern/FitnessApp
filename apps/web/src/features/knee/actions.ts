"use server";

import { revalidatePath } from "next/cache";
import { KNEE_TEST_SOURCE, kneeTestEntryRows } from "@fitness-app/application";
import { requireCurrentUser } from "@/lib/server/auth";
import { parseActionError } from "@/lib/server/parse-action-error";
import { createCoreServices } from "@/lib/server/services";
import { readKneeTestForm } from "./form-schema";
import type { KneeActionState } from "./types";

/**
 * Saves a knee test entry into knee_tests (source 'fitness_app'). Each
 * filled section replaces that section on the date; empty sections are left
 * alone, so ROM and the crane test can be saved separately on one day.
 */
export async function saveKneeTestAction(
  _previousState: KneeActionState,
  formData: FormData,
): Promise<KneeActionState> {
  try {
    const user = await requireCurrentUser();
    const entry = readKneeTestForm(formData);
    const { rows, replaceTypes } = kneeTestEntryRows(entry);
    if (rows.length === 0) {
      return { error: "Enter at least one value." };
    }
    const { programService } = await createCoreServices();
    await programService.replaceKneeTests({
      userId: user.id,
      source: KNEE_TEST_SOURCE,
      testDate: entry.testDate,
      replaceTypes,
      rows,
    });
    revalidatePath("/program/knee");
    revalidatePath("/program/review");
    revalidatePath("/program");
    revalidatePath("/dashboard");
    return { saved: { date: entry.testDate, rows: rows.length } };
  } catch (error) {
    return parseActionError(error);
  }
}
