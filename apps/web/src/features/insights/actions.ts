"use server";

import { requireCurrentUser } from "@/lib/server/auth";
import { createCoreServices } from "@/lib/server/services";

export async function dismissInsightAction(id: string): Promise<{ error?: string }> {
  const user = await requireCurrentUser();
  const { insightOrchestrator } = await createCoreServices();
  try {
    await insightOrchestrator.dismiss(id, user.id);
    return {};
  } catch (error) {
    console.error("[dismissInsightAction]", error instanceof Error ? error.message : error);
    return { error: "Unable to dismiss insight. Please try again." };
  }
}

export async function archiveInsightAction(id: string): Promise<{ error?: string }> {
  const user = await requireCurrentUser();
  const { insightOrchestrator } = await createCoreServices();
  try {
    await insightOrchestrator.archive(id, user.id);
    return {};
  } catch (error) {
    console.error("[archiveInsightAction]", error instanceof Error ? error.message : error);
    return { error: "Unable to archive insight. Please try again." };
  }
}
