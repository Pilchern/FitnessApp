import type { IsoDate, KneeTest } from "@fitness-app/domain";
import { bestBySide, lsiPct } from "./knee-tests";

/**
 * The Sunday scoreboard: one row per program week. Every cell is null when
 * the week has no data for it, so the table shows "no data" instead of
 * hiding the column.
 */

export type ScoreboardWeek = { week: number; start: IsoDate; end: IsoDate };

export type ScoreboardRow = ScoreboardWeek & {
  /** Mean of the week's weigh-ins (Withings), lb. */
  weightAvgLb: number | null;
  weightChangeLb: number | null;
  kcalAvg: number | null;
  proteinAvg: number | null;
  /** Days with calories logged. */
  nutritionDays: number;
  /** Crane-scale quad peak at 90°, best trial per leg on the week's last test. */
  quadPeakLeft: number | null;
  quadPeakRight: number | null;
  quadPeakUnit: string | null;
  quadLsi: number | null;
  /** Last tape reading in the week, in. */
  thighLIn: number | null;
  thighRIn: number | null;
  waistIn: number | null;
  stepsAvg: number | null;
  walkingAsymmetryPct: number | null;
};

type BodyRow = {
  measuredOn: IsoDate;
  weightLb: number | null;
  waistIn: number | null;
  thighLIn?: number | null;
  thighRIn?: number | null;
  source: { sourceType: string };
};

function mean(values: number[]) {
  return values.length > 0
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;
}

function round(value: number | null, dp: number) {
  if (value == null) return null;
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

function lastIn<T>(
  rows: T[],
  date: (row: T) => IsoDate,
  value: (row: T) => number | null | undefined,
  week: ScoreboardWeek,
) {
  const hit = rows
    .filter((r) => {
      const d = date(r);
      return d >= week.start && d <= week.end && value(r) != null;
    })
    .sort((a, b) => date(a).localeCompare(date(b)))
    .at(-1);
  return hit ? (value(hit) as number) : null;
}

export function weeklyScoreboard(input: {
  /** Oldest first. The change column compares with the week before. */
  weeks: ScoreboardWeek[];
  body: BodyRow[];
  nutrition: {
    logDate: IsoDate;
    calories?: number | null;
    proteinGrams?: number | null;
  }[];
  kneeTests: KneeTest[];
  activity: { metricDate: IsoDate; steps: number | null }[];
  /** Hand-typed weekly check-ins (walking asymmetry fallback). */
  checkins: { weekStart: IsoDate; walkingAsymmetryPct: number | null }[];
}): ScoreboardRow[] {
  const quad = bestBySide(input.kneeTests, "quad_iso_90");
  const quadUnit =
    input.kneeTests.find((t) => t.testType === "quad_iso_90")?.unit ?? null;
  const within = (d: IsoDate, w: ScoreboardWeek) => d >= w.start && d <= w.end;

  let previousAvg: number | null = null;
  return input.weeks.map((w) => {
    const weights = input.body
      .filter(
        (m) =>
          m.source.sourceType !== "manual" &&
          m.weightLb != null &&
          within(m.measuredOn, w),
      )
      .map((m) => m.weightLb as number);
    const weightAvg = mean(weights);
    const change =
      weightAvg != null && previousAvg != null ? weightAvg - previousAvg : null;
    previousAvg = weightAvg;

    const food = input.nutrition.filter((l) => within(l.logDate, w));
    const kcal = food
      .map((l) => l.calories)
      .filter((v): v is number => v != null);
    const protein = food
      .map((l) => l.proteinGrams)
      .filter((v): v is number => v != null);

    const test = quad.filter((p) => within(p.date, w)).at(-1) ?? null;
    const steps = input.activity
      .filter((a) => within(a.metricDate, w) && a.steps != null)
      .map((a) => a.steps as number);
    const asymmetry =
      lastIn(
        input.kneeTests.filter((t) => t.testType === "walking_asymmetry"),
        (t) => t.testDate,
        (t) => t.value,
        w,
      ) ??
      input.checkins.find((c) => c.weekStart === w.start)
        ?.walkingAsymmetryPct ??
      null;

    return {
      ...w,
      weightAvgLb: round(weightAvg, 1),
      weightChangeLb: round(change, 1),
      kcalAvg: round(mean(kcal), 0),
      proteinAvg: round(mean(protein), 0),
      nutritionDays: kcal.length,
      quadPeakLeft: test?.left ?? null,
      quadPeakRight: test?.right ?? null,
      quadPeakUnit: test ? quadUnit : null,
      quadLsi: test ? lsiPct(test.left, test.right) : null,
      thighLIn: lastIn(
        input.body,
        (m) => m.measuredOn,
        (m) => m.thighLIn,
        w,
      ),
      thighRIn: lastIn(
        input.body,
        (m) => m.measuredOn,
        (m) => m.thighRIn,
        w,
      ),
      waistIn: lastIn(
        input.body,
        (m) => m.measuredOn,
        (m) => m.waistIn,
        w,
      ),
      stepsAvg: round(mean(steps), 0),
      walkingAsymmetryPct: asymmetry,
    };
  });
}
