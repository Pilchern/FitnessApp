"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/server/auth";
import { parseActionError } from "@/lib/server/parse-action-error";
import { createCoreServices } from "@/lib/server/services";
import { getOwnerToday } from "./server";

const markHabitDoneSchema = z.object({ habitId: z.string().uuid() });

/** Ticks the routine's habit for today and returns to the dashboard. */
export async function markHabitDoneAction(
  _previousState: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  try {
    const user = await requireCurrentUser();
    const { habitId } = markHabitDoneSchema.parse({
      habitId: formData.get("habitId"),
    });
    const { supplementLogService } = await createCoreServices();
    await supplementLogService.logAdherence({
      userId: user.id,
      supplementId: habitId,
      logDate: await getOwnerToday(user.id),
      taken: true,
    });
    redirect("/dashboard");
  } catch (error) {
    return parseActionError(error);
  }
}
