"use server";

import { requireCurrentUser } from "@/lib/server/auth";
import { createCoreServices } from "@/lib/server/services";
import { parseActionError } from "@/lib/server/parse-action-error";

export type InsightActionResult = {
  error?: string;
};

export async function dismissInsightAction(id: string): Promise<InsightActionResult> {
  try {
    const user = await requireCurrentUser();
    const { insightOrchestrator } = await createCoreServices();
    await insightOrchestrator.dismiss(id, user.id);
    return {};
  } catch (error) {
    return parseActionError(error);
  }
}

export async function archiveInsightAction(id: string): Promise<InsightActionResult> {
  try {
    const user = await requireCurrentUser();
    const { insightOrchestrator } = await createCoreServices();
    await insightOrchestrator.archive(id, user.id);
    return {};
  } catch (error) {
    return parseActionError(error);
  }
}
