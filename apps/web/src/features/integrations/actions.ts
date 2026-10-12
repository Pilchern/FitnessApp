"use server";

import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/server/auth";
import {
  createWithingsSyncOrchestrator,
  generateAppleHealthWebhookToken,
  getWithingsIntegrationConfig,
} from "@/lib/server/integrations";
import type { AppleHealthWebhookTokenActionState } from "./types";

function errorRedirectUrl(message: string) {
  return `/integrations?error=${encodeURIComponent(message)}`;
}

export async function disconnectWithingsAction() {
  if (!getWithingsIntegrationConfig()) {
    redirect(errorRedirectUrl("Withings not configured"));
  }
  let url = "/integrations?status=disconnected";
  try {
    const user = await requireCurrentUser();
    const orchestrator = createWithingsSyncOrchestrator();
    await orchestrator.disconnect(user.id, "withings");
  } catch (error) {
    url = errorRedirectUrl(
      error instanceof Error ? error.message : "Disconnect failed.",
    );
  }
  redirect(url);
}

export async function syncWithingsAction(formData: FormData) {
  let url = "/integrations?status=sync_started";
  try {
    const user = await requireCurrentUser();
    const orchestrator = createWithingsSyncOrchestrator();
    await orchestrator.syncBodyMetrics({
      userId: user.id,
      provider: "withings",
      triggerType: formData.get("mode") === "full" ? "retry" : "manual",
      forceFullResync: formData.get("mode") === "full",
    });
  } catch (error) {
    url = errorRedirectUrl(
      error instanceof Error ? error.message : "Sync failed.",
    );
  }
  redirect(url);
}

/**
 * Generates (or rotates) the current user's Apple Health webhook token.
 * Unlike the other actions above, this does NOT redirect — it returns the
 * freshly generated plaintext token directly to the calling form via
 * useActionState, since the whole point is to let the user copy it. It is
 * never displayed again after this response; regenerating replaces it.
 */
export async function generateAppleHealthWebhookTokenAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by useActionState's action signature
  _previousState: AppleHealthWebhookTokenActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by useActionState's action signature
  _formData: FormData,
): Promise<AppleHealthWebhookTokenActionState> {
  try {
    const user = await requireCurrentUser();
    const token = await generateAppleHealthWebhookToken(user.id);
    return { token };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate Apple Health webhook token.",
    };
  }
}
