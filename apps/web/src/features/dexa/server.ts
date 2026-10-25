import "server-only";

import {
  addDays,
  compareDexaScans,
  DEXA_FIELDS,
  dexaAdjustedBodyFat,
  dexaCalibrations,
  dexaTargetProgress,
  getZonedDate,
  latestQuadLsi,
  programSettingsFromRows,
  quadLsiTrend,
} from "@fitness-app/application";
import { requireCurrentUser } from "@/lib/server/auth";
import {
  createCoreServices,
  getCachedUserProfile,
} from "@/lib/server/services";
import type { DexaPageData } from "./types";

/** Knee tests and waist readings loaded for the target rows. */
const LOOKBACK_DAYS = 400;
/** Logged isometrics count as a quad LSI reading too. */
const SESSION_LOOKBACK_DAYS = 120;

export async function getDexaPageData(): Promise<DexaPageData> {
  const user = await requireCurrentUser();
  const profile = await getCachedUserProfile(user.id);
  const today = getZonedDate(profile?.timezone || "UTC")
    .toISOString()
    .slice(0, 10);
  const {
    dexaScanService,
    programService,
    bodyMetricService,
    strengthService,
  } = await createCoreServices();
  const [scans, settingRows, kneeTests, body, sessions] = await Promise.all([
    dexaScanService.list(user.id),
    programService.listSettings(user.id),
    programService.listKneeTests(
      user.id,
      addDays(today, -LOOKBACK_DAYS),
      today,
    ),
    bodyMetricService.listByDateRange({
      userId: user.id,
      startDate: addDays(today, -LOOKBACK_DAYS),
      endDate: today,
      limit: 2000,
    }),
    strengthService.listByDateRange({
      userId: user.id,
      startDate: addDays(today, -SESSION_LOOKBACK_DAYS),
      endDate: today,
      limit: 500,
    }),
  ]);
  const heightCm = profile?.heightCm ?? null;
  const settings = programSettingsFromRows(settingRows);
  const comparison = compareDexaScans(scans, heightCm);
  const latest = comparison?.latest ?? null;

  const waists = body
    .filter((m) => m.waistIn != null)
    .sort((a, b) => a.measuredOn.localeCompare(b.measuredOn))
    .map((m) => ({ date: m.measuredOn, value: m.waistIn as number }));
  const quadFirst = quadLsiTrend(kneeTests)[0] ?? null;
  const quadLatest = latestQuadLsi(kneeTests, sessions, 90, today);

  const calibrations = dexaCalibrations(scans, body);

  return {
    scans,
    comparison,
    calibrations,
    adjustedBodyFat: dexaAdjustedBodyFat(calibrations, body, today),
    fields: DEXA_FIELDS,
    targets: dexaTargetProgress({
      scans,
      profileHeightCm: heightCm,
      quadLsiFirst: quadFirst
        ? { date: quadFirst.date, value: quadFirst.lsi }
        : null,
      quadLsiLatest:
        quadLatest?.lsi != null
          ? { date: quadLatest.date, value: quadLatest.lsi }
          : null,
      waistFirst: waists[0] ?? null,
      waistLatest: waists.at(-1) ?? null,
      settings,
    }),
    defaults: {
      facility: latest?.facility ?? "",
      machine: latest?.machine ?? "",
      heightIn: latest?.heightIn != null ? String(latest.heightIn) : "",
    },
  };
}
