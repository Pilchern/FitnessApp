import type {
  BodyMetric,
  CardioSession,
  IsoDate,
  RecoveryCheckin,
  WeeklyReviewScoreBand,
  WeeklyReviewScoreComponent,
  WeeklyReviewScoreDetails,
  WeeklyReviewSummary,
} from "@fitness-app/domain";
import { getZonedDate } from "../../shared/timezone";

export type WeeklyReviewAggregateInput = {
  bodyMetrics: BodyMetric[];
  cardioSessions: CardioSession[];
  recoveryCheckins: RecoveryCheckin[];
  liftsCompleted: number;
};

export type WeeklyReviewScoreInput = {
  summary: WeeklyReviewSummary;
  confidence: number | null;
};

export type WeeklyReviewScoringResult = {
  scoreDetails: WeeklyReviewScoreDetails;
  strategicDecision: string;
  riskForecast: string;
};

function roundOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function roundWhole(value: number) {
  return Math.round(value);
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return roundOneDecimal(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getWeekRangeFromStart(weekStart: IsoDate) {
  const start = new Date(`${weekStart}T12:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    weekStart,
    weekEnd: formatIsoDate(end),
  };
}

export function getCurrentWeekRangeForUser(
  timezone = "UTC",
  weekStartsOn: 0 | 1 = 1,
  referenceDate: Date = new Date(),
) {
  const base = getZonedDate(timezone, referenceDate);
  base.setUTCHours(12, 0, 0, 0);

  const daysSinceWeekStart =
    weekStartsOn === 1 ? (base.getUTCDay() + 6) % 7 : base.getUTCDay();

  const start = new Date(base);
  start.setUTCDate(base.getUTCDate() - daysSinceWeekStart);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  const isoStart = `${start.getUTCFullYear()}-${`${start.getUTCMonth() + 1}`.padStart(2, "0")}-${`${start.getUTCDate()}`.padStart(2, "0")}`;
  const isoEnd = `${end.getUTCFullYear()}-${`${end.getUTCMonth() + 1}`.padStart(2, "0")}-${`${end.getUTCDate()}`.padStart(2, "0")}`;

  return { weekStart: isoStart, weekEnd: isoEnd };
}

export function getLastCompletedWeekStart(referenceDate = new Date(), weekStartsOn: 0 | 1 = 1) {
  const base = new Date(referenceDate);
  base.setHours(12, 0, 0, 0);

  // Monday (1): Sun=6, Mon=0, Tue=1, …, Sat=5
  // Sunday (0): Sun=0, Mon=1, …, Sat=6
  const daysSinceWeekStart =
    weekStartsOn === 1 ? (base.getDay() + 6) % 7 : base.getDay();

  const currentWeekStart = new Date(base);
  currentWeekStart.setDate(base.getDate() - daysSinceWeekStart);

  const lastWeekStart = new Date(currentWeekStart);
  lastWeekStart.setDate(currentWeekStart.getDate() - 7);

  return formatIsoDate(lastWeekStart);
}

export function buildWeeklyReviewSummary({
  bodyMetrics,
  cardioSessions,
  recoveryCheckins,
  liftsCompleted,
}: WeeklyReviewAggregateInput): WeeklyReviewSummary {
  const averageWeightLb = average(
    bodyMetrics
      .map((metric) => metric.weightLb)
      .filter((value): value is number => value != null),
  );

  const latestWaistMetric = [...bodyMetrics]
    .sort((left, right) => right.measuredOn.localeCompare(left.measuredOn))
    .find((metric) => metric.waistIn != null);

  const completedRides = cardioSessions.filter(
    (session) =>
      session.plannedVsCompleted === "completed" && session.sessionKind !== "other",
  );

  const zone2Minutes = cardioSessions.reduce((sum, session) => {
    if (session.plannedVsCompleted === "skipped" || session.plannedVsCompleted === "planned") {
      return sum;
    }

    if (session.zone2Minutes != null) {
      return sum + session.zone2Minutes;
    }

    if (session.sessionKind === "zone2" && session.durationMinutes != null) {
      return sum + session.durationMinutes;
    }

    return sum;
  }, 0);

  const sleepAverageHours = average(
    recoveryCheckins
      .map((checkin) =>
        checkin.sleepDurationMinutes != null ? checkin.sleepDurationMinutes / 60 : null,
      )
      .filter((value): value is number => value != null),
  );

  const averageReadiness = average(
    recoveryCheckins
      .map((checkin) => checkin.readinessLevel)
      .filter((value): value is number => value != null),
  );

  // Count imported strength activities (WeightTraining, CrossFit, etc.) toward lifts
  const importedLifts = cardioSessions.filter(
    (session) =>
      session.plannedVsCompleted === "completed" && session.sessionKind === "other",
  ).length;

  return {
    averageWeightLb,
    waistIn: latestWaistMetric?.waistIn ?? null,
    liftsCompleted: liftsCompleted + importedLifts,
    ridesCompleted: completedRides.length,
    zone2Minutes,
    vo2Completed: cardioSessions.some(
      (session) =>
        session.sessionKind === "vo2" && session.plannedVsCompleted === "completed",
    ),
    sleepAverageHours,
    alcoholTotal:
      recoveryCheckins.length > 0
        ? recoveryCheckins.reduce((sum, checkin) => sum + checkin.alcoholCount, 0)
        : null,
    averageReadiness,
  };
}

function clampScore(value: number, maxScore: number) {
  return Math.max(0, Math.min(maxScore, value));
}

function bandForScore(score: number): WeeklyReviewScoreBand {
  if (score >= 85) {
    return "strong";
  }

  if (score >= 70) {
    return "solid";
  }

  return "fragile";
}

export function calculateWeeklyReviewScore({
  summary,
  confidence,
}: WeeklyReviewScoreInput): WeeklyReviewScoringResult {
  const liftsCompleted = summary.liftsCompleted ?? 0;
  const ridesCompleted = summary.ridesCompleted ?? 0;
  const zone2Minutes = summary.zone2Minutes ?? 0;
  const vo2Completed = summary.vo2Completed === true;
  const sleepAverageHours = summary.sleepAverageHours;
  const alcoholTotal = summary.alcoholTotal;

  const components: WeeklyReviewScoreComponent[] = [
    {
      key: "lifts",
      label: "Lifts completed",
      score: clampScore(roundWhole((Math.min(liftsCompleted, 3) / 3) * 25), 25),
      maxScore: 25,
      detail: `${liftsCompleted}/3 target lifts logged`,
    },
    {
      key: "rides",
      label: "Rides completed",
      score: clampScore(roundWhole((Math.min(ridesCompleted, 3) / 3) * 20), 20),
      maxScore: 20,
      detail: `${ridesCompleted}/3 target rides completed`,
    },
    {
      key: "zone2",
      label: "Zone 2 minutes",
      score: clampScore(roundWhole((Math.min(zone2Minutes, 90) / 90) * 10), 10),
      maxScore: 10,
      detail: `${zone2Minutes} / 90 target Zone 2 minutes`,
    },
    {
      key: "vo2",
      label: "VO2 session",
      score: vo2Completed ? 5 : 0,
      maxScore: 5,
      detail: vo2Completed ? "VO2 session completed" : "VO2 session missed",
    },
    {
      key: "sleep",
      label: "Sleep average",
      score:
        sleepAverageHours == null
          ? 10
          : sleepAverageHours >= 7.5
            ? 20
            : sleepAverageHours >= 7
              ? 16
              : sleepAverageHours >= 6.5
                ? 12
                : sleepAverageHours >= 6
                  ? 8
                  : 4,
      maxScore: 20,
      detail:
        sleepAverageHours == null
          ? "No sleep average logged, neutral score applied"
          : `${sleepAverageHours}h average sleep`,
    },
    {
      key: "alcohol",
      label: "Alcohol total",
      score:
        alcoholTotal == null
          ? 5
          : alcoholTotal <= 2
            ? 10
            : alcoholTotal <= 4
              ? 7
              : alcoholTotal <= 6
                ? 4
                : 1,
      maxScore: 10,
      detail:
        alcoholTotal == null
          ? "No alcohol total logged, neutral score applied"
          : `${alcoholTotal} total drinks`,
    },
    {
      key: "confidence",
      label: "Subjective confidence",
      score:
        confidence == null
          ? 5
          : clampScore(roundWhole((Math.min(confidence, 10) / 10) * 10), 10),
      maxScore: 10,
      detail:
        confidence == null
          ? "No confidence set, neutral score applied"
          : `${confidence}/10 confidence`,
    },
  ];

  const totalScore = components.reduce((sum, component) => sum + component.score, 0);
  const band = bandForScore(totalScore);

  let strategicDecision = "Stay steady and close the biggest gap next week.";
  if ((sleepAverageHours ?? 7) < 6.5 || (alcoholTotal ?? 0) > 4 || (confidence ?? 7) <= 4) {
    strategicDecision = "Protect recovery before adding more intensity.";
  } else if (liftsCompleted < 2 || ridesCompleted < 2) {
    strategicDecision = "Reduce friction and reestablish baseline consistency.";
  } else if (
    liftsCompleted >= 3 &&
    ridesCompleted >= 3 &&
    zone2Minutes >= 90 &&
    vo2Completed &&
    (confidence ?? 0) >= 7
  ) {
    strategicDecision = "Hold the plan and progress one lever modestly next week.";
  }

  let riskForecast =
    "Low risk: adherence and recovery are stable enough to carry momentum into next week.";
  if ((sleepAverageHours ?? 7) < 6.5 || (alcoholTotal ?? 0) > 6 || (confidence ?? 7) <= 3) {
    riskForecast =
      "High risk: under-recovery could compromise lift quality and make the next VO2 session harder than planned.";
  } else if (liftsCompleted < 3 || ridesCompleted < 3 || zone2Minutes < 90) {
    riskForecast =
      "Moderate risk: missing baseline sessions could slow progress unless next week starts with a cleaner routine.";
  }

  return {
    scoreDetails: {
      version: "v1",
      totalScore,
      band,
      components,
    },
    strategicDecision,
    riskForecast,
  };
}
