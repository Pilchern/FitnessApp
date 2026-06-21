"use server";

import { requireCurrentUser } from "@/lib/server/auth";
import { createCoreServices } from "@/lib/server/services";

export async function dismissInsightAction(id: string): Promise<void> {
  const user = await requireCurrentUser();
  const { insightOrchestrator } = await createCoreServices();
  try {
    await insightOrchestrator.dismiss(id, user.id);
  } catch (error) {
    console.error("[dismissInsightAction]", error instanceof Error ? error.message : error);
  }
}

export async function archiveInsightAction(id: string): Promise<void> {
  const user = await requireCurrentUser();
  const { insightOrchestrator } = await createCoreServices();
  try {
    await insightOrchestrator.archive(id, user.id);
  } catch (error) {
    console.error("[archiveInsightAction]", error instanceof Error ? error.message : error);
  }
}
