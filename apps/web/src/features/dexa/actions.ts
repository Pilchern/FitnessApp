"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/server/auth";
import { parseActionError } from "@/lib/server/parse-action-error";
import { createCoreServices } from "@/lib/server/services";
import { readDexaForm } from "./form-schema";
import type { DexaActionState } from "./types";

/** Saves a scan; a second save on the same date replaces it. */
export async function saveDexaScanAction(
  _previousState: DexaActionState,
  formData: FormData,
): Promise<DexaActionState> {
  try {
    const user = await requireCurrentUser();
    const input = readDexaForm(formData);
    const { dexaScanService } = await createCoreServices();
    const scan = await dexaScanService.save({ ...input, userId: user.id });
    revalidatePath("/body/dexa");
    revalidatePath("/body");
    revalidatePath("/dashboard");
    return { saved: scan.scanDate };
  } catch (error) {
    return parseActionError(error);
  }
}
