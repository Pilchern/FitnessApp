import type {
  BodyMetric,
  CardioSession,
  ExerciseCatalogEntry,
  Insight,
  IsoDate,
  RecoveryCheckin,
  StrengthSession,
  WeeklyReview,
} from "@fitness-app/domain";
import { buildWeeklyReviewSummary, getLastCompletedWeekStart, getWeekRangeFromStart } from "../weekly-reviews/weekly-review-helpers";
import { getZonedDate } from "../../shared/timezone";
import { computeMuscleGroupVolume } from "../strength/muscle-group-volume";

export type InsightEngineInput = {
  bodyMetrics: BodyMetric[];
  cardioSessions: CardioSession[];
  recoveryCheckins: RecoveryCheckin[];
  weeklyReviews: WeeklyReview[];
  strengthSessions: StrengthSession[];
  liftsCompletedByWeek: Record<IsoDate, number>;
  /** Per-user exercise catalog overrides (TD-021), checked before the built-in catalog when classifying strength sets. */
  exerciseOverrides?: ReadonlyMap<string, ExerciseCatalogEntry>;
  now?: Date;
  timezone?: string;
};

const MAJOR_MUSCLE_GROUP_LABELS: Record<string, string> = {
  chest: "chest",
  back: "back",
  shoulders: "shoulders",
  quads: "quads",
  hamstrings: "hamstrings",
  glutes: "glutes",
};

const MAJOR_MUSCLE_GROUPS = Object.keys(MAJOR_MUSCLE_GROUP_LABELS);

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toIsoDateUtc(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function addDaysUtc(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function makeInsight(
  insightDate: IsoDate,
  insightType: Insight["insightType"],
  severity: Insight["severity"],
  title: string,
  explanation: string,
  recommendedNextAction: string,
  evidence: Record<string, unknown>,
): Insight {
  return {
    id: `${insightType}:${insightDate}`,
    insightDate,
    insightType,
    title,
    severity,
    explanation,
    recommendedNextAction,
    evidence,
    sourceKind: "rule",
  };
}

function compareAverages(values: Array<number | null | undefined>) {
  const present = values.filter((value): value is number => value != null);
  if (present.length === 0) {
    return null;
  }

  return Math.round((present.reduce((sum, value) => sum + value, 0) / present.length) * 10) / 10;
}

function getCompletedWeeklyReviews(weeklyReviews: WeeklyReview[]) {
  return [...weeklyReviews]
    .filter((review) => review.status === "completed")
    .sort((left, right) => right.weekStart.localeCompare(left.weekStart));
}

function getReviewForWeek(weeklyReviews: WeeklyReview[], weekStart: IsoDate) {
  return weeklyReviews.find((review) => review.weekStart === weekStart) ?? null;
}

function buildWeekSummary(
  weekStart: IsoDate,
  input: InsightEngineInput,
) {
  const { weekEnd } = getWeekRangeFromStart(weekStart);
  const bodyMetrics = input.bodyMetrics.filter(
    (metric) => metric.measuredOn >= weekStart && metric.measuredOn <= weekEnd,
  );
  const cardioSessions = input.cardioSessions.filter(
    (session) => session.sessionDate >= weekStart && session.sessionDate <= weekEnd,
  );
  const recoveryCheckins = input.recoveryCheckins.filter(
    (checkin) => checkin.checkinDate >= weekStart && checkin.checkinDate <= weekEnd,
  );

  return buildWeeklyReviewSummary({
    bodyMetrics,
    cardioSessions,
    recoveryCheckins,
    liftsCompleted: input.liftsCompletedByWeek[weekStart] ?? 0,
  });
}

function evaluateCardioBelowTarget(input: InsightEngineInput) {
  const weekStart = getLastCompletedWeekStart(input.now);
  const review = getReviewForWeek(input.weeklyReviews, weekStart);
  const summary = review?.summary ?? buildWeekSummary(weekStart, input);
  const ridesCompleted = summary.ridesCompleted ?? 0;

  if (ridesCompleted >= 3) {
    return null;
  }

  return makeInsight(
    weekStart,
    "cardio_sessions_below_target",
    ridesCompleted <= 1 ? "warning" : "caution",
    "Cardio sessions fell short last week",
    `Only ${ridesCompleted} cardio session${ridesCompleted === 1 ? "" : "s"} completed in the week starting ${weekStart}. The target is 3 cardio sessions per week.`,
    "Protect the Tuesday, Thursday, and Saturday slots first before adding anything extra.",
    {
      weekStart,
      ridesCompleted,
      targetRides: 3,
    },
  );
}

function evaluateRepeatedMissedSaturday(input: InsightEngineInput) {
  const now = input.now ?? new Date();
  const tz = input.timezone || "UTC";
  const current = getZonedDate(tz, now);
  current.setUTCHours(12, 0, 0, 0);
  const saturdayDates: string[] = [];

  for (let index = 0; index < 3; index += 1) {
    const date = addDaysUtc(current, -(index * 7));
    while (date.getUTCDay() !== 6) {
      date.setUTCDate(date.getUTCDate() - 1);
    }
    saturdayDates.push(toIsoDateUtc(date));
  }

  const missed = saturdayDates.filter((date) => {
    const sessions = input.cardioSessions.filter((session) => session.sessionDate === date);
    return !sessions.some(
      (session) =>
        session.sessionKind === "zone2" &&
        (session.plannedVsCompleted === "completed" ||
          session.plannedVsCompleted === "partial"),
    );
  });

  if (missed.length < 2) {
    return null;
  }

  return makeInsight(
    saturdayDates[0],
    "repeated_missed_saturday",
    "warning",
    "Saturday long rides are slipping repeatedly",
    `${missed.length} of the last 3 Saturdays missed the long Zone 2 anchor session, which is one of the highest-value aerobic slots in the week.`,
    "Simplify Saturday setup now: define start time, ride length floor, and any night-before preparation.",
    {
      saturdayDates,
      missedSaturdayDates: missed,
    },
  );
}

function evaluatePoorRecoveryTrend(input: InsightEngineInput) {
  const sorted = [...input.recoveryCheckins].sort((left, right) =>
    right.checkinDate.localeCompare(left.checkinDate),
  );
  const recent = sorted.slice(0, 3);
  const previous = sorted.slice(3, 6);

  if (recent.length < 2 || previous.length < 2) {
    return null;
  }

  const recentSleep = compareAverages(
    recent.map((checkin) =>
      checkin.sleepDurationMinutes != null ? checkin.sleepDurationMinutes / 60 : null,
    ),
  );
  const previousSleep = compareAverages(
    previous.map((checkin) =>
      checkin.sleepDurationMinutes != null ? checkin.sleepDurationMinutes / 60 : null,
    ),
  );
  const recentReadiness = compareAverages(recent.map((checkin) => checkin.readinessLevel));
  const previousReadiness = compareAverages(previous.map((checkin) => checkin.readinessLevel));
  const recentRestingHr = compareAverages(recent.map((checkin) => checkin.restingHeartRate));
  const previousRestingHr = compareAverages(
    previous.map((checkin) => checkin.restingHeartRate),
  );

  const sleepDown =
    recentSleep != null && previousSleep != null && previousSleep - recentSleep >= 0.5;
  const readinessDown =
    recentReadiness != null &&
    previousReadiness != null &&
    previousReadiness - recentReadiness >= 1;
  const restingHrUp =
    recentRestingHr != null &&
    previousRestingHr != null &&
    recentRestingHr - previousRestingHr >= 2;

  const worseningSignals = [sleepDown, readinessDown, restingHrUp].filter(Boolean).length;
  if (worseningSignals < 2) {
    return null;
  }

  return makeInsight(
    recent[0].checkinDate,
    "poor_recovery_trend",
    "warning",
    "Recovery is trending the wrong direction",
    `Recent check-ins show sleep${sleepDown ? " down" : ""}, readiness${readinessDown ? " down" : ""}${restingHrUp ? ", and resting HR up" : ""} versus the prior block.`,
    "Reduce optional intensity this week and protect sleep consistency before chasing extra volume.",
    {
      recentSleep,
      previousSleep,
      recentReadiness,
      previousReadiness,
      recentRestingHr,
      previousRestingHr,
    },
  );
}

function evaluatePositiveWaistTrend(input: InsightEngineInput) {
  const reviews = getCompletedWeeklyReviews(input.weeklyReviews);
  const latest = reviews[0];
  const previous = reviews[1];

  if (!latest || !previous) {
    return null;
  }

  const latestWaist = latest.summary.waistIn;
  const previousWaist = previous.summary.waistIn;
  const latestRides = latest.summary.ridesCompleted ?? 0;
  const latestLifts = latest.summary.liftsCompleted ?? 0;

  if (
    latestWaist == null ||
    previousWaist == null ||
    previousWaist - latestWaist < 0.2 ||
    latestRides < 2 ||
    latestLifts < 2
  ) {
    return null;
  }

  return makeInsight(
    latest.weekStart,
    "positive_waist_trend",
    "positive",
    "Waist is moving down while adherence is holding",
    `Waist dropped from ${previousWaist} in to ${latestWaist} in while the week still held ${latestLifts} lifts and ${latestRides} rides.`,
    "Stay patient and keep the same adherence floor instead of forcing a more aggressive cut.",
    {
      latestWeekStart: latest.weekStart,
      previousWeekStart: previous.weekStart,
      latestWaist,
      previousWaist,
      latestLifts,
      latestRides,
    },
  );
}

function evaluateAlcoholRecoveryCaution(input: InsightEngineInput) {
  const reviews = getCompletedWeeklyReviews(input.weeklyReviews);
  const latest = reviews[0];
  const previous = reviews[1];

  if (!latest || !previous) {
    return null;
  }

  const latestAlcohol = latest.summary.alcoholTotal ?? 0;
  const previousAlcohol = previous.summary.alcoholTotal ?? 0;
  const latestSleep = latest.summary.sleepAverageHours;
  const previousSleep = previous.summary.sleepAverageHours;

  const alcoholElevated = latestAlcohol >= 4 && latestAlcohol > previousAlcohol;
  const sleepWorse =
    latestSleep != null && previousSleep != null && previousSleep - latestSleep >= 0.4;

  if (!alcoholElevated || !sleepWorse) {
    return null;
  }

  return makeInsight(
    latest.weekStart,
    "alcohol_recovery_caution",
    "caution",
    "Alcohol rose while recovery slipped",
    `Alcohol total increased to ${latestAlcohol} and sleep average dipped from ${previousSleep}h to ${latestSleep}h in the same period.`,
    "Pick one lower-alcohol rule for the next 7 days and watch whether sleep and readiness rebound.",
    {
      latestAlcohol,
      previousAlcohol,
      latestSleep,
      previousSleep,
    },
  );
}

function evaluateMissingWeeklyReview(input: InsightEngineInput) {
  const weekStart = getLastCompletedWeekStart(input.now);
  const latestReview = getReviewForWeek(getCompletedWeeklyReviews(input.weeklyReviews), weekStart);

  if (latestReview) {
    return null;
  }

  return makeInsight(
    weekStart,
    "missing_weekly_review",
    "caution",
    "Last week's review is still missing",
    `The week that started ${weekStart} has logged data but no completed weekly review, so lessons and next-step decisions are at risk of getting lost.`,
    "Complete the weekly review before planning the next week so the score and decision stay anchored to real data.",
    {
      weekStart,
    },
  );
}

function evaluateZone2BelowTarget(input: InsightEngineInput) {
  const weekStart = getLastCompletedWeekStart(input.now);
  const review = getReviewForWeek(input.weeklyReviews, weekStart);
  const summary = review?.summary ?? buildWeekSummary(weekStart, input);
  const zone2Minutes = summary.zone2Minutes ?? 0;

  if (zone2Minutes >= 90) {
    return null;
  }

  const severity = zone2Minutes === 0 ? "warning" : zone2Minutes <= 59 ? "caution" : "info";

  return makeInsight(
    weekStart,
    "zone2_below_target",
    severity,
    "Zone 2 time fell short",
    `${zone2Minutes} min logged vs. 90 min weekly target.`,
    "Aim for 3 sessions of 30+ minutes at a conversational pace to hit the 90-minute baseline.",
    {
      weekStart,
      zone2Minutes,
      targetMinutes: 90,
    },
  );
}

function evaluateConsecutiveStrengthMissed(input: InsightEngineInput) {
  const weekStart = getLastCompletedWeekStart(input.now);
  const previousWeekStart = toIsoDate(addDays(new Date(`${weekStart}T12:00:00`), -7));

  const lastReview = getReviewForWeek(input.weeklyReviews, weekStart);
  const prevReview = getReviewForWeek(input.weeklyReviews, previousWeekStart);

  const lastLifts =
    lastReview?.summary.liftsCompleted ?? input.liftsCompletedByWeek[weekStart] ?? 0;
  const prevLifts =
    prevReview?.summary.liftsCompleted ?? input.liftsCompletedByWeek[previousWeekStart] ?? 0;

  if (lastLifts > 0 || prevLifts > 0) {
    return null;
  }

  return makeInsight(
    weekStart,
    "consecutive_strength_missed",
    "warning",
    "No strength sessions in 2 weeks",
    "Strength work dropped off for two consecutive weeks.",
    "Two sessions of 45+ minutes per week maintains muscle. Schedule them before the week starts.",
    {
      weekStart,
      previousWeekStart,
      lastLifts,
      prevLifts,
    },
  );
}

function evaluateSleepBelowTarget(input: InsightEngineInput) {
  const weekStart = getLastCompletedWeekStart(input.now);
  const review = getReviewForWeek(input.weeklyReviews, weekStart);
  const summary = review?.summary ?? buildWeekSummary(weekStart, input);
  const sleepAverageHours = summary.sleepAverageHours;

  if (sleepAverageHours == null || sleepAverageHours >= 7) {
    return null;
  }

  const severity = sleepAverageHours < 6 ? "warning" : "caution";

  return makeInsight(
    weekStart,
    "sleep_below_target",
    severity,
    "Sleep below target last week",
    `Average sleep was ${sleepAverageHours}h. The target is 7+ hours.`,
    "Prioritize an earlier bedtime — even 30 minutes earlier compounded across a week adds 3.5 hours.",
    {
      weekStart,
      sleepAverageHours,
      targetHours: 7,
    },
  );
}

function evaluateAlcoholElevated(input: InsightEngineInput) {
  const weekStart = getLastCompletedWeekStart(input.now);
  const review = getReviewForWeek(input.weeklyReviews, weekStart);
  const summary = review?.summary ?? buildWeekSummary(weekStart, input);
  const alcoholTotal = summary.alcoholTotal;

  if (alcoholTotal == null || alcoholTotal <= 7) {
    return null;
  }

  const severity = alcoholTotal >= 15 ? "warning" : "caution";

  return makeInsight(
    weekStart,
    "alcohol_elevated",
    severity,
    "Alcohol intake was elevated",
    `${alcoholTotal} drinks logged last week.`,
    "High alcohol intake disrupts sleep quality and recovery. Try to stay under 7 drinks per week.",
    {
      weekStart,
      alcoholTotal,
      threshold: 7,
    },
  );
}

function evaluateWeightTrendingUp(input: InsightEngineInput) {
  const reviews = getCompletedWeeklyReviews(input.weeklyReviews);
  const last4 = reviews.slice(0, 4);

  if (last4.length < 4) {
    return null;
  }

  const weights = last4.map((review) => review.summary.averageWeightLb ?? null);
  if (weights.some((w) => w == null)) {
    return null;
  }

  const validWeights = weights as number[];
  // reviews are sorted newest-first; reverse to check oldest→newest monotonic increase
  const ordered = [...validWeights].reverse();
  const isMonotonic = ordered.every((w, index) => index === 0 || w > ordered[index - 1]);
  const delta = Math.round((ordered[ordered.length - 1] - ordered[0]) * 10) / 10;

  if (!isMonotonic || delta <= 3) {
    return null;
  }

  return makeInsight(
    last4[0].weekStart,
    "weight_trending_up",
    "caution",
    "Weight trending up",
    `Weight has increased ${delta} lb over the past 4 weeks.`,
    "Review calorie intake and cardio output. A small deficit of 200–300 kcal/day is sustainable.",
    {
      weekStarts: last4.map((r) => r.weekStart),
      weights: ordered,
      delta,
    },
  );
}

function evaluateStrongWeek(input: InsightEngineInput) {
  const weekStart = getLastCompletedWeekStart(input.now);
  const review = getReviewForWeek(input.weeklyReviews, weekStart);
  const summary = review?.summary ?? buildWeekSummary(weekStart, input);

  const liftsCompleted = summary.liftsCompleted ?? 0;
  const ridesCompleted = summary.ridesCompleted ?? 0;
  const zone2Minutes = summary.zone2Minutes ?? 0;

  if (liftsCompleted < 3 || ridesCompleted < 3 || zone2Minutes < 90) {
    return null;
  }

  return makeInsight(
    weekStart,
    "strong_week",
    "info",
    "Strong training week",
    "All three pillars hit — strength, cardio, and zone 2.",
    "Keep it up. Consistency at this level leads to measurable improvements in 4–6 weeks.",
    {
      weekStart,
      liftsCompleted,
      ridesCompleted,
      zone2Minutes,
    },
  );
}

function evaluateMuscleGroupNeglected(input: InsightEngineInput) {
  const now = input.now ?? new Date();
  const rangeEnd = toIsoDate(now);
  const rangeStart = toIsoDate(addDays(now, -6));

  const summary = computeMuscleGroupVolume(
    input.strengthSessions,
    { startDate: rangeStart, endDate: rangeEnd },
    input.exerciseOverrides,
  );

  const majorGroups = summary.byMuscleGroup.filter((g) => MAJOR_MUSCLE_GROUPS.includes(g.muscleGroup));
  const trainedMajor = majorGroups.filter((g) => g.workingSetCount > 0);
  const neglectedMajor = majorGroups.filter((g) => g.workingSetCount === 0);

  // Only worth flagging once there's been meaningful training this week —
  // otherwise "neglected" just means "haven't gotten to it yet".
  const totalMajorSets = majorGroups.reduce((sum, g) => sum + g.workingSetCount, 0);
  if (trainedMajor.length === 0 || neglectedMajor.length === 0 || totalMajorSets < 6) {
    return null;
  }

  const chest = majorGroups.find((g) => g.muscleGroup === "chest");
  const back = majorGroups.find((g) => g.muscleGroup === "back");

  let title: string;
  let explanation: string;

  if (chest && back && chest.workingSetCount >= 2 && back.workingSetCount === 0) {
    title = "Chest trained, back skipped this week";
    explanation = `${chest.workingSetCount} chest working sets logged this week, but 0 for back. Pressing and pulling volume should generally track together.`;
  } else if (chest && back && back.workingSetCount >= 2 && chest.workingSetCount === 0) {
    title = "Back trained, chest skipped this week";
    explanation = `${back.workingSetCount} back working sets logged this week, but 0 for chest.`;
  } else {
    const names = neglectedMajor.map((g) => MAJOR_MUSCLE_GROUP_LABELS[g.muscleGroup]).join(", ");
    title = `${neglectedMajor.length === 1 ? "A muscle group" : "Muscle groups"} sitting untouched this week`;
    explanation = `${trainedMajor.length} major muscle group${trainedMajor.length === 1 ? "" : "s"} trained this week, but not: ${names}.`;
  }

  return makeInsight(
    rangeEnd,
    "muscle_group_neglected",
    "caution",
    title,
    explanation,
    "Add one exercise for the untrained group to your next session, or dedicate a session to it before the week ends.",
    {
      rangeStart,
      rangeEnd,
      byMuscleGroup: majorGroups,
    },
  );
}

function evaluatePushPullImbalance(input: InsightEngineInput) {
  const now = input.now ?? new Date();
  const rangeEnd = toIsoDate(now);
  const rangeStart = toIsoDate(addDays(now, -13));

  const summary = computeMuscleGroupVolume(
    input.strengthSessions,
    { startDate: rangeStart, endDate: rangeEnd },
    input.exerciseOverrides,
  );

  const push = summary.byMovementPattern.find((p) => p.movementPattern === "push");
  const pull = summary.byMovementPattern.find((p) => p.movementPattern === "pull");
  const ratio = summary.pushPullVolumeRatio;

  // Require a meaningful combined sample so the ratio isn't noise from one or two sets.
  const combinedVolume = (push?.totalVolume ?? 0) + (pull?.totalVolume ?? 0);
  if (ratio == null || combinedVolume < 2000) {
    return null;
  }

  if (ratio < 1.4 && ratio > 0.71) {
    return null;
  }

  const pushHeavy = ratio >= 1.4;
  const higher = pushHeavy ? "Pressing" : "Pulling";
  const lower = pushHeavy ? "pulling" : "pressing";
  const displayRatio = pushHeavy ? ratio : Math.round((1 / ratio) * 100) / 100;

  return makeInsight(
    rangeEnd,
    "push_pull_imbalance",
    "caution",
    `${higher} volume is outpacing ${lower}`,
    `Over the last 14 days, ${higher.toLowerCase()} volume has been ${displayRatio}x ${lower} volume (push: ${push?.totalVolume ?? 0} lb, pull: ${pull?.totalVolume ?? 0} lb).`,
    `Add an extra ${lower} exercise or set to your next couple of sessions to bring the ratio back toward even.`,
    {
      rangeStart,
      rangeEnd,
      pushVolume: push?.totalVolume ?? 0,
      pullVolume: pull?.totalVolume ?? 0,
      ratio,
    },
  );
}

function evaluateDeloadSuggested(input: InsightEngineInput) {
  const reviews = getCompletedWeeklyReviews(input.weeklyReviews);
  const last3 = reviews.slice(0, 3);

  if (last3.length < 3 || last3.some((review) => (review.summary.liftsCompleted ?? 0) < 3)) {
    return null;
  }

  const sortedRecovery = [...input.recoveryCheckins].sort((left, right) =>
    right.checkinDate.localeCompare(left.checkinDate),
  );
  const recent = sortedRecovery.slice(0, 3);
  const previous = sortedRecovery.slice(3, 6);

  if (recent.length < 2 || previous.length < 2) {
    return null;
  }

  const recentReadiness = compareAverages(recent.map((checkin) => checkin.readinessLevel));
  const previousReadiness = compareAverages(previous.map((checkin) => checkin.readinessLevel));

  const readinessDown =
    recentReadiness != null &&
    previousReadiness != null &&
    previousReadiness - recentReadiness >= 1;

  if (!readinessDown) {
    return null;
  }

  return makeInsight(
    last3[0].weekStart,
    "deload_suggested",
    "caution",
    "You may benefit from a lighter training week",
    `3 consecutive weeks of consistent strength training (3+ lifts each) while readiness has dropped from ${previousReadiness} to ${recentReadiness}.`,
    "Consider a lighter week: drop a set or two per exercise, or swap one lift session for light Zone 2 cardio, then reassess readiness.",
    {
      weekStarts: last3.map((r) => r.weekStart),
      recentReadiness,
      previousReadiness,
    },
  );
}

function evaluateCardioTargetConsistentlyExceeded(input: InsightEngineInput) {
  const reviews = getCompletedWeeklyReviews(input.weeklyReviews);
  const last3 = reviews.slice(0, 3);

  if (last3.length < 3) {
    return null;
  }

  const allExceeded = last3.every((review) => (review.summary.ridesCompleted ?? 0) >= 4);
  if (!allExceeded) {
    return null;
  }

  return makeInsight(
    last3[0].weekStart,
    "cardio_target_consistently_exceeded",
    "positive",
    "Consistently exceeding your cardio target",
    `4+ cardio sessions completed in each of the last 3 weeks, above the 3-session weekly target.`,
    "This is sustainable as long as recovery and strength sessions aren't slipping — keep an eye on both.",
    {
      weekStarts: last3.map((r) => r.weekStart),
      ridesByWeek: last3.map((r) => r.summary.ridesCompleted ?? 0),
    },
  );
}

const severityRank: Record<Insight["severity"], number> = {
  warning: 4,
  caution: 3,
  info: 2,
  positive: 1,
};

export function buildInsights(input: InsightEngineInput): Insight[] {
  const insights = [
    evaluateCardioBelowTarget(input),
    evaluateRepeatedMissedSaturday(input),
    evaluatePoorRecoveryTrend(input),
    evaluatePositiveWaistTrend(input),
    evaluateAlcoholRecoveryCaution(input),
    evaluateMissingWeeklyReview(input),
    evaluateZone2BelowTarget(input),
    evaluateConsecutiveStrengthMissed(input),
    evaluateSleepBelowTarget(input),
    evaluateAlcoholElevated(input),
    evaluateWeightTrendingUp(input),
    evaluateStrongWeek(input),
    evaluateMuscleGroupNeglected(input),
    evaluatePushPullImbalance(input),
    evaluateDeloadSuggested(input),
    evaluateCardioTargetConsistentlyExceeded(input),
  ].filter((insight): insight is Insight => insight != null);

  return insights.sort((left, right) => {
    const severityDifference = severityRank[right.severity] - severityRank[left.severity];
    if (severityDifference !== 0) {
      return severityDifference;
    }

    return right.insightDate.localeCompare(left.insightDate);
  });
}

export function getTopInsights(insights: Insight[], limit = 3) {
  return insights.slice(0, limit);
}
