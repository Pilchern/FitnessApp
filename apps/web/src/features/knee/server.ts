import "server-only";

import {
  addDays,
  gateBoards,
  getZonedDate,
  KNEE_TEST_SOURCE,
  leftQuadDrop,
  legExerciseIndex,
  legSessionDayBefore,
  programSettingsFromRows,
  quadLsiByDate,
  quadLsiTrend,
} from "@fitness-app/application";
import { requireCurrentUser } from "@/lib/server/auth";
import {
  createCoreServices,
  getCachedUserProfile,
} from "@/lib/server/services";
import type { KneePageData } from "./types";

const LOOKBACK_DAYS = 400;

export async function getKneePageData(): Promise<KneePageData> {
  const user = await requireCurrentUser();
  const profile = await getCachedUserProfile(user.id);
  const today = getZonedDate(profile?.timezone || "UTC")
    .toISOString()
    .slice(0, 10);
  const { programService, strengthService } = await createCoreServices();
  const [settingRows, tests, program, checks] = await Promise.all([
    programService.listSettings(user.id),
    programService.listKneeTests(
      user.id,
      addDays(today, -LOOKBACK_DAYS),
      today,
    ),
    programService.getActiveProgram(user.id),
    programService.listKneeChecks(user.id, addDays(today, -30), today),
  ]);
  const settings = programSettingsFromRows(settingRows);
  const gates = gateBoards({
    tests,
    checks,
    gates: program?.gates ?? [],
    today,
    lsiTargets: [settings.lsiTarget1, settings.lsiTarget2, settings.lsiTarget3],
    walkingAsymmetryTargetPct: settings.walkingAsymmetryTargetPct,
  });

  const quad = quadLsiByDate(tests);
  const last = quad[quad.length - 1] ?? null;
  const legNames = legExerciseIndex(
    (program?.sessions ?? [])
      .flatMap((s) => s.exercises)
      .filter((e) => e.blockPart === "legs"),
  );
  const sessionsBefore = last
    ? await strengthService.listByDateRange({
        userId: user.id,
        startDate: addDays(last.date, -1),
        endDate: addDays(last.date, -1),
      })
    : [];
  const lastSources = last
    ? [
        ...new Set(
          tests
            .filter(
              (t) => t.testType === "quad_iso_90" && t.testDate === last.date,
            )
            .map((t) => t.source),
        ),
      ]
    : [];
  const drop = leftQuadDrop(tests, today, settings.quadDropHoldN);

  const mine = new Map<string, number>();
  for (const t of tests) {
    if (t.source !== KNEE_TEST_SOURCE || t.testType.endsWith("_warmup")) {
      continue;
    }
    mine.set(t.testDate, (mine.get(t.testDate) ?? 0) + 1);
  }

  return {
    today,
    spreadLimitN: settings.quadDropHoldN,
    lsiTargets: [settings.lsiTarget1, settings.lsiTarget2, settings.lsiTarget3],
    trend: quadLsiTrend(tests),
    latest: last
      ? {
          date: last.date,
          left: last.left,
          right: last.right,
          lsi: last.lsi,
          denominator: last.denominator,
          basis: last.basis,
          legSessionDayBefore: legSessionDayBefore(
            sessionsBefore,
            legNames,
            last.date,
          ),
          source: lastSources.join(" + "),
        }
      : null,
    quadDrop: drop
      ? { dropN: drop.dropN, previousLeft: drop.previousLeft, left: drop.left }
      : null,
    rightBests: quad
      .filter((p): p is typeof p & { right: number } => p.right != null)
      .map((p) => ({ date: p.date, right: p.right })),
    recent: [...mine.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8),
    tests,
    gates,
  };
}
