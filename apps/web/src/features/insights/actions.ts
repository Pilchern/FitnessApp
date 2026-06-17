"use server";

import { requireCurrentUser } from "@/lib/server/auth";
import { createCoreServices } from "@/lib/server/services";

export async function dismissInsightAction(id: string): Promise<void> {
  const user = await requireCurrentUser();
  const { insightOrchestrator } = await createCoreServices();
  await insightOrchestrator.dismiss(id, user.id);
}

export async function archiveInsightAction(id: string): Promise<void> {
  const user = await requireCurrentUser();
  const { insightOrchestrator } = await createCoreServices();
  await insightOrchestrator.archive(id, user.id);
}
