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
  userId: string;
  appUrl: string;
  snapshot: IntegrationStatusSnapshot;
  flashMessage: {
    tone: "success" | "error";
    text: string;
  } | null;
};
