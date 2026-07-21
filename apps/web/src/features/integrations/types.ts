import type { IntegrationStatusSnapshot } from "@fitness-app/application";
import type { IntegrationConnection } from "@fitness-app/domain";

export type IntegrationsPageData = {
  withingsConfigured: boolean;
  withingsConnection: IntegrationConnection | null;
  pelotonConfigured: boolean;
  pelotonConnection: IntegrationConnection | null;
  stravaConfigured: boolean;
  stravaConnection: IntegrationConnection | null;
  appleHealthConfigured: boolean;
  appleHealthConnection: IntegrationConnection | null;
  appleHealthHasWebhookToken: boolean;
  userId: string;
  appUrl: string;
  snapshot: IntegrationStatusSnapshot;
  flashMessage: {
    tone: "success" | "error";
    text: string;
  } | null;
};

// Returns the freshly generated token itself (rather than a redirect + flash
// message like the other integration actions) since it's a secret the user
// needs to copy immediately — it isn't stored in a form retrievable in
// plaintext again later, so there's no page to redirect back to that could
// show it.
export type AppleHealthWebhookTokenActionState = {
  token?: string;
  error?: string;
};
