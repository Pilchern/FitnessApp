import "server-only";

import { compareDexaScans, DEXA_FIELDS } from "@fitness-app/application";
import { requireCurrentUser } from "@/lib/server/auth";
import {
  createCoreServices,
  getCachedUserProfile,
} from "@/lib/server/services";
import type { DexaPageData } from "./types";

export async function getDexaPageData(): Promise<DexaPageData> {
  const user = await requireCurrentUser();
  const { dexaScanService } = await createCoreServices();
  const [scans, profile] = await Promise.all([
    dexaScanService.list(user.id),
    getCachedUserProfile(user.id),
  ]);
  const comparison = compareDexaScans(scans, profile?.heightCm ?? null);
  const latest = comparison?.latest ?? null;
  return {
    scans,
    comparison,
    fields: DEXA_FIELDS,
    defaults: {
      facility: latest?.facility ?? "",
      machine: latest?.machine ?? "",
      heightIn: latest?.heightIn != null ? String(latest.heightIn) : "",
    },
  };
}
