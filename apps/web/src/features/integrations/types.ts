import type { IntegrationStatusSnapshot } from "@fitness-app/application";
import type { IntegrationConnection } from "@fitness-app/domain";
import type { AppleHealthStream, AppleHealthStreamStatus } from "./helpers";

export type IntegrationsPageData = {
  withingsConfigured: boolean;
  withingsConnection: IntegrationConnection | null;
  appleHealthConfigured: boolean;
  appleHealthConnection: IntegrationConnection | null;
  appleHealthHasWebhookToken: boolean;
  /** Latest successful run per Apple Health stream, formatted on the server. */
  appleHealthStreams: Record<AppleHealthStream, AppleHealthStreamStatus>;
  /** Latest failed Apple Health run, only when no success has followed it. */
  appleHealthFailure: {
    label: string;
    at: string;
    message: string | null;
  } | null;
  /** Profile timezone, for formatting times in server components. */
  timeZone: string;
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
