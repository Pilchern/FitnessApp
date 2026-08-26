import { describe, expect, it } from "vitest";
import type {
  BodyMetric,
  CardioSession,
  RecoveryCheckin,
  StrengthExerciseSet,
  StrengthSession,
  WeeklyReview,
} from "@fitness-app/domain";
import { buildInsights, getTopInsights } from "../../index";

const userId = "11111111-1111-4111-8111-111111111111";

function manualSource() {
  return {
    sourceType: "manual" as const,
    sourceProvider: null,
    sourceExternalId: null,
    importBatchId: null,
    rawImportEventId: null,
  };
}

function makeStrengthSet(
  overrides: Partial<StrengthExerciseSet> &
    Pick<StrengthExerciseSet, "exerciseName">,
): StrengthExerciseSet {
  return {
    id: `set-${Math.random()}`,
    userId,
    strengthSessionId: "session-1",
    exerciseOrder: 0,
    setNumber: 1,
    reps: 8,
    weight: 100,
    rir: 2,
    isWarmup: false,
    durationSeconds: null,
    distanceMeters: null,
    notes: null,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function makeStrengthSession(
  sessionDate: string,
  sets: StrengthExerciseSet[],
): StrengthSession {
  return {
    id: `session-${sessionDate}`,
    userId,
    trainingTemplateId: null,
    sessionDate,
    sessionName: null,
    notes: null,
    durationMinutes: 45,
    readinessPre: null,
    energyPost: null,
    completedAsPlanned: true,
    source: manualSource(),
    createdAt: `${sessionDate}T12:00:00.000Z`,
    updatedAt: `${sessionDate}T12:00:00.000Z`,
    deletedAt: null,
    sets,
  };
}

describe("insight rules", () => {
  it("builds explainable caution, warning, and positive insights from stored data", () => {
    const bodyMetrics: BodyMetric[] = [
      {
        id: "body-1",
        userId,
        measuredOn: "2026-03-22",
        weightLb: 190.8,
        weightKg: null,
        waistIn: 34.8,
        waistCm: null,
        waistHipIn: null,
        waistGutIn: null,
        bodyFatPct: null,
        muscleMassLb: null,
        muscleMassKg: null,
        boneMassKg: null,
        boneMassLb: null,
        fatFreeMassKg: null,
        fatFreeMassLb: null,
        hydrationPct: null,
        visceralFatIndex: null,
        notes: null,
        source: manualSource(),
        createdAt: "2026-03-22T00:00:00.000Z",
        updatedAt: "2026-03-22T00:00:00.000Z",
        deletedAt: null,
      },
      {
        id: "body-2",
        userId,
        measuredOn: "2026-03-29",
        weightLb: 189.9,
        weightKg: null,
        waistIn: 34.3,
        waistCm: null,
        waistHipIn: null,
        waistGutIn: null,
        bodyFatPct: null,
        muscleMassLb: null,
        muscleMassKg: null,
        boneMassKg: null,
        boneMassLb: null,
        fatFreeMassKg: null,
        fatFreeMassLb: null,
        hydrationPct: null,
        visceralFatIndex: null,
        notes: null,
        source: manualSource(),
        createdAt: "2026-03-29T00:00:00.000Z",
        updatedAt: "2026-03-29T00:00:00.000Z",
        deletedAt: null,
      },
    ];

    const cardioSessions: CardioSession[] = [
      {
        id: "ride-1",
        userId,
        trainingTemplateId: null,
        sessionDate: "2026-03-17",
        startedAt: null,
        endedAt: null,
        sessionKind: "zone2",
        plannedVsCompleted: "completed",
        durationMinutes: 50,
        zone2Minutes: 45,
        avgHeartRate: null,
        maxHeartRate: null,
        avgOutput: null,
        cadenceMin: null,
        cadenceMax: null,
        resistanceMin: null,
        resistanceMax: null,
        intervalStructure: null,
        rpe: null,
        distanceMeters: null,
        notes: null,
        sportType: null,
        source: manualSource(),
        createdAt: "2026-03-17T00:00:00.000Z",
        updatedAt: "2026-03-17T00:00:00.000Z",
        deletedAt: null,
      },
      {
        id: "ride-2",
        userId,
        trainingTemplateId: null,
        sessionDate: "2026-03-24",
        startedAt: null,
        endedAt: null,
        sessionKind: "zone2",
        plannedVsCompleted: "completed",
        durationMinutes: 50,
        zone2Minutes: 45,
        avgHeartRate: null,
        maxHeartRate: null,
        avgOutput: null,
        cadenceMin: null,
        cadenceMax: null,
        resistanceMin: null,
        resistanceMax: null,
        intervalStructure: null,
        rpe: null,
        distanceMeters: null,
        notes: null,
        sportType: null,
        source: manualSource(),
        createdAt: "2026-03-24T00:00:00.000Z",
        updatedAt: "2026-03-24T00:00:00.000Z",
        deletedAt: null,
      },
    ];

    const recoveryCheckins: RecoveryCheckin[] = [
      {
        id: "recovery-1",
        userId,
        checkinDate: "2026-03-20",
        restingHeartRate: 55,
        hrv: null,
        sleepDurationMinutes: 465,
        sleepQuality: 4,
        energyLevel: null,
        readinessLevel: 8,
        stressLevel: 3,
        sorenessLevel: 3,
        alcoholCount: 0,
        notes: null,
        timeInBedMinutes: null,
        sleepEfficiencyPct: null,
        deepSleepMinutes: null,
        remSleepMinutes: null,
        coreSleepMinutes: null,
        awakeMinutes: null,
        sleepRespiratoryRate: null,
        sleepSpo2AvgPct: null,
        sleepHrvAvg: null,
        sleepAvgHeartRate: null,
        bedtimeLocal: null,
        wakeTimeLocal: null,
        coldPlungeCompleted: null,
        source: manualSource(),
        createdAt: "2026-03-20T00:00:00.000Z",
        updatedAt: "2026-03-20T00:00:00.000Z",
        deletedAt: null,
      },
      {
        id: "recovery-2",
        userId,
        checkinDate: "2026-03-21",
        restingHeartRate: 55,
        hrv: null,
        sleepDurationMinutes: 450,
        sleepQuality: 4,
        energyLevel: null,
        readinessLevel: 8,
        stressLevel: 3,
        sorenessLevel: 3,
        alcoholCount: 0,
        notes: null,
        timeInBedMinutes: null,
        sleepEfficiencyPct: null,
        deepSleepMinutes: null,
        remSleepMinutes: null,
        coreSleepMinutes: null,
        awakeMinutes: null,
        sleepRespiratoryRate: null,
        sleepSpo2AvgPct: null,
        sleepHrvAvg: null,
        sleepAvgHeartRate: null,
        bedtimeLocal: null,
        wakeTimeLocal: null,
        coldPlungeCompleted: null,
        source: manualSource(),
        createdAt: "2026-03-21T00:00:00.000Z",
        updatedAt: "2026-03-21T00:00:00.000Z",
        deletedAt: null,
      },
      {
        id: "recovery-3",
        userId,
        checkinDate: "2026-03-22",
        restingHeartRate: 56,
        hrv: null,
        sleepDurationMinutes: 440,
        sleepQuality: 4,
        energyLevel: null,
        readinessLevel: 7,
        stressLevel: 4,
        sorenessLevel: 3,
        alcoholCount: 1,
        notes: null,
        timeInBedMinutes: null,
        sleepEfficiencyPct: null,
        deepSleepMinutes: null,
        remSleepMinutes: null,
        coreSleepMinutes: null,
        awakeMinutes: null,
        sleepRespiratoryRate: null,
        sleepSpo2AvgPct: null,
        sleepHrvAvg: null,
        sleepAvgHeartRate: null,
        bedtimeLocal: null,
        wakeTimeLocal: null,
        coldPlungeCompleted: null,
        source: manualSource(),
        createdAt: "2026-03-22T00:00:00.000Z",
        updatedAt: "2026-03-22T00:00:00.000Z",
        deletedAt: null,
      },
      {
        id: "recovery-4",
        userId,
        checkinDate: "2026-03-27",
        restingHeartRate: 59,
        hrv: null,
        sleepDurationMinutes: 390,
        sleepQuality: 3,
        energyLevel: null,
        readinessLevel: 5,
        stressLevel: 5,
        sorenessLevel: 4,
        alcoholCount: 2,
        notes: null,
        timeInBedMinutes: null,
        sleepEfficiencyPct: null,
        deepSleepMinutes: null,
        remSleepMinutes: null,
        coreSleepMinutes: null,
        awakeMinutes: null,
        sleepRespiratoryRate: null,
        sleepSpo2AvgPct: null,
        sleepHrvAvg: null,
        sleepAvgHeartRate: null,
        bedtimeLocal: null,
        wakeTimeLocal: null,
        coldPlungeCompleted: null,
        source: manualSource(),
        createdAt: "2026-03-27T00:00:00.000Z",
        updatedAt: "2026-03-27T00:00:00.000Z",
        deletedAt: null,
      },
      {
        id: "recovery-5",
        userId,
        checkinDate: "2026-03-28",
        restingHeartRate: 60,
        hrv: null,
        sleepDurationMinutes: 375,
        sleepQuality: 3,
        energyLevel: null,
        readinessLevel: 5,
        stressLevel: 6,
        sorenessLevel: 5,
        alcoholCount: 2,
        notes: null,
        timeInBedMinutes: null,
        sleepEfficiencyPct: null,
        deepSleepMinutes: null,
        remSleepMinutes: null,
        coreSleepMinutes: null,
        awakeMinutes: null,
        sleepRespiratoryRate: null,
        sleepSpo2AvgPct: null,
        sleepHrvAvg: null,
        sleepAvgHeartRate: null,
        bedtimeLocal: null,
        wakeTimeLocal: null,
        coldPlungeCompleted: null,
        source: manualSource(),
        createdAt: "2026-03-28T00:00:00.000Z",
        updatedAt: "2026-03-28T00:00:00.000Z",
        deletedAt: null,
      },
      {
        id: "recovery-6",
        userId,
        checkinDate: "2026-03-29",
        restingHeartRate: 60,
        hrv: null,
        sleepDurationMinutes: 380,
        sleepQuality: 3,
        energyLevel: null,
        readinessLevel: 4,
        stressLevel: 6,
        sorenessLevel: 5,
        alcoholCount: 2,
        notes: null,
        timeInBedMinutes: null,
        sleepEfficiencyPct: null,
        deepSleepMinutes: null,
        remSleepMinutes: null,
        coreSleepMinutes: null,
        awakeMinutes: null,
        sleepRespiratoryRate: null,
        sleepSpo2AvgPct: null,
        sleepHrvAvg: null,
        sleepAvgHeartRate: null,
        bedtimeLocal: null,
        wakeTimeLocal: null,
        coldPlungeCompleted: null,
        source: manualSource(),
        createdAt: "2026-03-29T00:00:00.000Z",
        updatedAt: "2026-03-29T00:00:00.000Z",
        deletedAt: null,
      },
    ];

    const weeklyReviews: WeeklyReview[] = [
      {
        id: "review-1",
        userId,
        weekStart: "2026-03-16",
        weekEnd: "2026-03-22",
        status: "completed",
        summary: {
          waistIn: 34.8,
          liftsCompleted: 3,
          ridesCompleted: 3,
          zone2Minutes: 96,
          vo2Completed: true,
          sleepAverageHours: 7.4,
          alcoholTotal: 2,
        },
        bestWin: null,
        biggestMiss: null,
        lesson: null,
        nextWeekPriority: null,
        confidence: 7,
        scoreDetails: null,
        strategicDecision: null,
        riskForecast: null,
        manualOverrides: {},
        aiDraft: null,
        aiDraftStatus: "none",
        completedAt: "2026-03-22T20:00:00.000Z",
        createdAt: "2026-03-22T20:00:00.000Z",
        updatedAt: "2026-03-22T20:00:00.000Z",
        deletedAt: null,
      },
      {
        id: "review-2",
        userId,
        weekStart: "2026-03-23",
        weekEnd: "2026-03-29",
        status: "completed",
        summary: {
          waistIn: 34.3,
          liftsCompleted: 3,
          ridesCompleted: 2,
          zone2Minutes: 45,
          vo2Completed: false,
          sleepAverageHours: 6.4,
          alcoholTotal: 6,
        },
        bestWin: null,
        biggestMiss: null,
        lesson: null,
        nextWeekPriority: null,
        confidence: 5,
        scoreDetails: null,
        strategicDecision: null,
        riskForecast: null,
        manualOverrides: {},
        aiDraft: null,
        aiDraftStatus: "none",
        completedAt: "2026-03-29T20:00:00.000Z",
        createdAt: "2026-03-29T20:00:00.000Z",
        updatedAt: "2026-03-29T20:00:00.000Z",
        deletedAt: null,
      },
    ];

    const insights = buildInsights({
      bodyMetrics,
      cardioSessions,
      recoveryCheckins,
      weeklyReviews,
      strengthSessions: [],
      liftsCompletedByWeek: {
        "2026-03-16": 3,
        "2026-03-23": 3,
      },
      now: new Date("2026-04-01T12:00:00-05:00"),
    });

    expect(insights.map((insight) => insight.insightType)).toEqual([
      "poor_recovery_trend",
      "repeated_missed_saturday",
      "cardio_sessions_below_target",
      "alcohol_recovery_caution",
      "zone2_below_target",
      "sleep_below_target",
      "positive_waist_trend",
    ]);

    expect(
      insights.find(
        (insight) => insight.insightType === "repeated_missed_saturday",
      )?.recommendedNextAction,
    ).toMatch(/Saturday/);
    expect(
      insights.find((insight) => insight.insightType === "poor_recovery_trend")
        ?.explanation,
    ).toMatch(/sleep down/);
    expect(
      insights.find((insight) => insight.insightType === "positive_waist_trend")
        ?.severity,
    ).toBe("positive");
    expect(getTopInsights(insights, 2)).toHaveLength(2);
  });

  // ── Helpers for focused rule tests ──────────────────────────────────────

  function makeWeeklyReview(
    weekStart: string,
    summary: {
      liftsCompleted?: number;
      ridesCompleted?: number;
      zone2Minutes?: number;
      sleepAverageHours?: number | null;
      alcoholTotal?: number | null;
      averageWeightLb?: number | null;
      waistIn?: number | null;
      vo2Completed?: boolean;
    } = {},
  ): WeeklyReview {
    return {
      id: `review-${weekStart}`,
      userId,
      weekStart,
      weekEnd: (() => {
        const d = new Date(`${weekStart}T12:00:00`);
        d.setDate(d.getDate() + 6);
        const y = d.getFullYear();
        const m = `${d.getMonth() + 1}`.padStart(2, "0");
        const day = `${d.getDate()}`.padStart(2, "0");
        return `${y}-${m}-${day}`;
      })(),
      status: "completed",
      summary: {
        liftsCompleted: summary.liftsCompleted ?? 0,
        ridesCompleted: summary.ridesCompleted ?? 0,
        zone2Minutes: summary.zone2Minutes ?? 0,
        sleepAverageHours: summary.sleepAverageHours ?? null,
        alcoholTotal: summary.alcoholTotal ?? null,
        averageWeightLb: summary.averageWeightLb ?? null,
        waistIn: summary.waistIn ?? null,
        vo2Completed: summary.vo2Completed ?? false,
      },
      bestWin: null,
      biggestMiss: null,
      lesson: null,
      nextWeekPriority: null,
      confidence: null,
      scoreDetails: null,
      strategicDecision: null,
      riskForecast: null,
      manualOverrides: {},
      aiDraft: null,
      aiDraftStatus: "none",
      completedAt: `${weekStart}T20:00:00.000Z`,
      createdAt: `${weekStart}T20:00:00.000Z`,
      updatedAt: `${weekStart}T20:00:00.000Z`,
      deletedAt: null,
    };
  }

  function emptyInput(
    overrides: Partial<Parameters<typeof buildInsights>[0]> = {},
  ): Parameters<typeof buildInsights>[0] {
    return {
      bodyMetrics: [],
      cardioSessions: [],
      recoveryCheckins: [],
      weeklyReviews: [],
      strengthSessions: [],
      liftsCompletedByWeek: {},
      ...overrides,
    };
  }

  // now = 2026-04-06 (Monday) → last completed week starts 2026-03-30
  const TEST_NOW = new Date("2026-04-06T12:00:00Z");

  // ── Rule: zone2_below_target ────────────────────────────────────────────

  describe("zone2_below_target", () => {
    it("fires a warning when zone2Minutes is 0", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [makeWeeklyReview("2026-03-30", { zone2Minutes: 0 })],
          now: TEST_NOW,
        }),
      );
      const insight = insights.find(
        (i) => i.insightType === "zone2_below_target",
      );
      expect(insight).toBeDefined();
      expect(insight?.severity).toBe("warning");
      expect(insight?.explanation).toContain("0 min");
    });

    it("fires a caution when zone2Minutes is 1–59", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [makeWeeklyReview("2026-03-30", { zone2Minutes: 45 })],
          now: TEST_NOW,
        }),
      );
      const insight = insights.find(
        (i) => i.insightType === "zone2_below_target",
      );
      expect(insight).toBeDefined();
      expect(insight?.severity).toBe("caution");
    });

    it("fires an info insight when zone2Minutes is 60–89", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [makeWeeklyReview("2026-03-30", { zone2Minutes: 75 })],
          now: TEST_NOW,
        }),
      );
      const insight = insights.find(
        (i) => i.insightType === "zone2_below_target",
      );
      expect(insight).toBeDefined();
      expect(insight?.severity).toBe("info");
    });

    it("does not fire when zone2Minutes >= 90", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [makeWeeklyReview("2026-03-30", { zone2Minutes: 90 })],
          now: TEST_NOW,
        }),
      );
      expect(
        insights.find((i) => i.insightType === "zone2_below_target"),
      ).toBeUndefined();
    });
  });

  // ── Rule: consecutive_strength_missed ──────────────────────────────────

  describe("consecutive_strength_missed", () => {
    it("fires a warning when both last and previous week had 0 lifts", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [
            makeWeeklyReview("2026-03-30", { liftsCompleted: 0 }),
            makeWeeklyReview("2026-03-23", { liftsCompleted: 0 }),
          ],
          liftsCompletedByWeek: { "2026-03-30": 0, "2026-03-23": 0 },
          now: TEST_NOW,
        }),
      );
      const insight = insights.find(
        (i) => i.insightType === "consecutive_strength_missed",
      );
      expect(insight).toBeDefined();
      expect(insight?.severity).toBe("warning");
    });

    it("does not fire when the last completed week had lifts", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [
            makeWeeklyReview("2026-03-30", { liftsCompleted: 2 }),
            makeWeeklyReview("2026-03-23", { liftsCompleted: 0 }),
          ],
          liftsCompletedByWeek: { "2026-03-30": 2, "2026-03-23": 0 },
          now: TEST_NOW,
        }),
      );
      expect(
        insights.find((i) => i.insightType === "consecutive_strength_missed"),
      ).toBeUndefined();
    });

    it("does not fire when only the last week had 0 lifts", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [
            makeWeeklyReview("2026-03-30", { liftsCompleted: 0 }),
            makeWeeklyReview("2026-03-23", { liftsCompleted: 3 }),
          ],
          liftsCompletedByWeek: { "2026-03-30": 0, "2026-03-23": 3 },
          now: TEST_NOW,
        }),
      );
      expect(
        insights.find((i) => i.insightType === "consecutive_strength_missed"),
      ).toBeUndefined();
    });

    it("fires when no review data exists (falls back to 0 lifts for both weeks)", () => {
      const insights = buildInsights(emptyInput({ now: TEST_NOW }));
      expect(
        insights.find((i) => i.insightType === "consecutive_strength_missed"),
      ).toBeDefined();
    });
  });

  // ── Rule: sleep_below_target ───────────────────────────────────────────

  describe("sleep_below_target", () => {
    it("fires a warning when sleep average is below 6 hours", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [
            makeWeeklyReview("2026-03-30", { sleepAverageHours: 5.5 }),
          ],
          now: TEST_NOW,
        }),
      );
      const insight = insights.find(
        (i) => i.insightType === "sleep_below_target",
      );
      expect(insight).toBeDefined();
      expect(insight?.severity).toBe("warning");
      expect(insight?.explanation).toContain("5.5h");
    });

    it("fires a caution when sleep average is 6–6.9 hours", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [
            makeWeeklyReview("2026-03-30", { sleepAverageHours: 6.5 }),
          ],
          now: TEST_NOW,
        }),
      );
      const insight = insights.find(
        (i) => i.insightType === "sleep_below_target",
      );
      expect(insight).toBeDefined();
      expect(insight?.severity).toBe("caution");
    });

    it("does not fire when sleep average is 7 hours or above", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [
            makeWeeklyReview("2026-03-30", { sleepAverageHours: 7.0 }),
          ],
          now: TEST_NOW,
        }),
      );
      expect(
        insights.find((i) => i.insightType === "sleep_below_target"),
      ).toBeUndefined();
    });

    it("does not fire when sleepAverageHours is null", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [
            makeWeeklyReview("2026-03-30", { sleepAverageHours: null }),
          ],
          now: TEST_NOW,
        }),
      );
      expect(
        insights.find((i) => i.insightType === "sleep_below_target"),
      ).toBeUndefined();
    });
  });

  // ── Rule: alcohol_elevated ─────────────────────────────────────────────

  describe("alcohol_elevated", () => {
    it("fires a caution when alcohol total is 8–14 drinks", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [makeWeeklyReview("2026-03-30", { alcoholTotal: 10 })],
          now: TEST_NOW,
        }),
      );
      const insight = insights.find(
        (i) => i.insightType === "alcohol_elevated",
      );
      expect(insight).toBeDefined();
      expect(insight?.severity).toBe("caution");
      expect(insight?.explanation).toContain("10 drinks");
    });

    it("fires a warning when alcohol total is 15 or more drinks", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [makeWeeklyReview("2026-03-30", { alcoholTotal: 16 })],
          now: TEST_NOW,
        }),
      );
      const insight = insights.find(
        (i) => i.insightType === "alcohol_elevated",
      );
      expect(insight).toBeDefined();
      expect(insight?.severity).toBe("warning");
    });

    it("does not fire when alcohol total is 7 or below", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [makeWeeklyReview("2026-03-30", { alcoholTotal: 7 })],
          now: TEST_NOW,
        }),
      );
      expect(
        insights.find((i) => i.insightType === "alcohol_elevated"),
      ).toBeUndefined();
    });

    it("does not fire when alcoholTotal is null", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [
            makeWeeklyReview("2026-03-30", { alcoholTotal: null }),
          ],
          now: TEST_NOW,
        }),
      );
      expect(
        insights.find((i) => i.insightType === "alcohol_elevated"),
      ).toBeUndefined();
    });
  });

  // ── Rule: weight_trending_up ───────────────────────────────────────────

  describe("weight_trending_up", () => {
    it("fires a caution when weight increases monotonically by more than 3 lbs over 4 weeks", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [
            makeWeeklyReview("2026-03-30", { averageWeightLb: 196.0 }),
            makeWeeklyReview("2026-03-23", { averageWeightLb: 194.5 }),
            makeWeeklyReview("2026-03-16", { averageWeightLb: 193.0 }),
            makeWeeklyReview("2026-03-09", { averageWeightLb: 192.0 }),
          ],
          now: TEST_NOW,
        }),
      );
      const insight = insights.find(
        (i) => i.insightType === "weight_trending_up",
      );
      expect(insight).toBeDefined();
      expect(insight?.severity).toBe("caution");
      expect(insight?.explanation).toContain("4 lb");
    });

    it("does not fire when weight increase is 3 lbs or less", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [
            makeWeeklyReview("2026-03-30", { averageWeightLb: 195.0 }),
            makeWeeklyReview("2026-03-23", { averageWeightLb: 194.0 }),
            makeWeeklyReview("2026-03-16", { averageWeightLb: 193.0 }),
            makeWeeklyReview("2026-03-09", { averageWeightLb: 192.0 }),
          ],
          now: TEST_NOW,
        }),
      );
      expect(
        insights.find((i) => i.insightType === "weight_trending_up"),
      ).toBeUndefined();
    });

    it("does not fire when weight is not monotonically increasing", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [
            makeWeeklyReview("2026-03-30", { averageWeightLb: 196.0 }),
            makeWeeklyReview("2026-03-23", { averageWeightLb: 194.0 }),
            makeWeeklyReview("2026-03-16", { averageWeightLb: 195.0 }),
            makeWeeklyReview("2026-03-09", { averageWeightLb: 192.0 }),
          ],
          now: TEST_NOW,
        }),
      );
      expect(
        insights.find((i) => i.insightType === "weight_trending_up"),
      ).toBeUndefined();
    });

    it("does not fire when fewer than 4 weeks of data exist", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [
            makeWeeklyReview("2026-03-30", { averageWeightLb: 196.0 }),
            makeWeeklyReview("2026-03-23", { averageWeightLb: 194.0 }),
            makeWeeklyReview("2026-03-16", { averageWeightLb: 193.0 }),
          ],
          now: TEST_NOW,
        }),
      );
      expect(
        insights.find((i) => i.insightType === "weight_trending_up"),
      ).toBeUndefined();
    });

    it("does not fire when averageWeightLb is null for any week", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [
            makeWeeklyReview("2026-03-30", { averageWeightLb: 196.0 }),
            makeWeeklyReview("2026-03-23", { averageWeightLb: null }),
            makeWeeklyReview("2026-03-16", { averageWeightLb: 193.0 }),
            makeWeeklyReview("2026-03-09", { averageWeightLb: 192.0 }),
          ],
          now: TEST_NOW,
        }),
      );
      expect(
        insights.find((i) => i.insightType === "weight_trending_up"),
      ).toBeUndefined();
    });
  });

  // ── Rule: strong_week ─────────────────────────────────────────────────

  describe("strong_week", () => {
    it("fires an info insight when all three pillars are hit in the last completed week", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [
            makeWeeklyReview("2026-03-30", {
              liftsCompleted: 3,
              ridesCompleted: 3,
              zone2Minutes: 90,
            }),
          ],
          liftsCompletedByWeek: { "2026-03-30": 3 },
          now: TEST_NOW,
        }),
      );
      const insight = insights.find((i) => i.insightType === "strong_week");
      expect(insight).toBeDefined();
      expect(insight?.severity).toBe("info");
      expect(insight?.explanation).toContain("All three pillars");
    });

    it("does not fire when lifts are below 3", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [
            makeWeeklyReview("2026-03-30", {
              liftsCompleted: 2,
              ridesCompleted: 3,
              zone2Minutes: 90,
            }),
          ],
          now: TEST_NOW,
        }),
      );
      expect(
        insights.find((i) => i.insightType === "strong_week"),
      ).toBeUndefined();
    });

    it("does not fire when cardio rides are below 3", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [
            makeWeeklyReview("2026-03-30", {
              liftsCompleted: 3,
              ridesCompleted: 2,
              zone2Minutes: 90,
            }),
          ],
          now: TEST_NOW,
        }),
      );
      expect(
        insights.find((i) => i.insightType === "strong_week"),
      ).toBeUndefined();
    });

    it("does not fire when zone 2 minutes are below 90", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [
            makeWeeklyReview("2026-03-30", {
              liftsCompleted: 3,
              ridesCompleted: 3,
              zone2Minutes: 89,
            }),
          ],
          now: TEST_NOW,
        }),
      );
      expect(
        insights.find((i) => i.insightType === "strong_week"),
      ).toBeUndefined();
    });

    it("does not fire when no review data exists", () => {
      const insights = buildInsights(emptyInput({ now: TEST_NOW }));
      expect(
        insights.find((i) => i.insightType === "strong_week"),
      ).toBeUndefined();
    });
  });

  // ── Rule: muscle_group_neglected ────────────────────────────────────────

  describe("muscle_group_neglected", () => {
    it("fires when chest is trained but back is skipped with meaningful weekly volume", () => {
      const insights = buildInsights(
        emptyInput({
          strengthSessions: [
            makeStrengthSession("2026-04-01", [
              makeStrengthSet({
                exerciseName: "Barbell Bench Press",
                setNumber: 1,
              }),
              makeStrengthSet({
                exerciseName: "Barbell Bench Press",
                setNumber: 2,
              }),
            ]),
            makeStrengthSession("2026-04-03", [
              makeStrengthSet({ exerciseName: "Back Squat", setNumber: 1 }),
              makeStrengthSet({ exerciseName: "Back Squat", setNumber: 2 }),
              makeStrengthSet({ exerciseName: "Back Squat", setNumber: 3 }),
              makeStrengthSet({ exerciseName: "Back Squat", setNumber: 4 }),
            ]),
          ],
          now: TEST_NOW,
        }),
      );
      const insight = insights.find(
        (i) => i.insightType === "muscle_group_neglected",
      );
      expect(insight).toBeDefined();
      expect(insight?.title).toMatch(/back skipped/i);
    });

    it("does not fire when there isn't enough weekly training volume to judge", () => {
      const insights = buildInsights(
        emptyInput({
          strengthSessions: [
            makeStrengthSession("2026-04-01", [
              makeStrengthSet({
                exerciseName: "Barbell Bench Press",
                setNumber: 1,
              }),
              makeStrengthSet({
                exerciseName: "Barbell Bench Press",
                setNumber: 2,
              }),
            ]),
          ],
          now: TEST_NOW,
        }),
      );
      expect(
        insights.find((i) => i.insightType === "muscle_group_neglected"),
      ).toBeUndefined();
    });

    it("does not fire when every major muscle group has been trained", () => {
      const insights = buildInsights(
        emptyInput({
          strengthSessions: [
            makeStrengthSession("2026-04-01", [
              makeStrengthSet({
                exerciseName: "Barbell Bench Press",
                setNumber: 1,
              }),
              makeStrengthSet({
                exerciseName: "Barbell Bench Press",
                setNumber: 2,
              }),
              makeStrengthSet({ exerciseName: "Barbell Row", setNumber: 1 }),
              makeStrengthSet({ exerciseName: "Barbell Row", setNumber: 2 }),
              makeStrengthSet({ exerciseName: "Back Squat", setNumber: 1 }),
              makeStrengthSet({ exerciseName: "Back Squat", setNumber: 2 }),
              makeStrengthSet({ exerciseName: "Overhead Press", setNumber: 1 }),
              makeStrengthSet({
                exerciseName: "Romanian Deadlift",
                setNumber: 1,
              }),
              makeStrengthSet({ exerciseName: "Hip Thrust", setNumber: 1 }),
            ]),
          ],
          now: TEST_NOW,
        }),
      );
      expect(
        insights.find((i) => i.insightType === "muscle_group_neglected"),
      ).toBeUndefined();
    });
  });

  // ── Rule: push_pull_imbalance ────────────────────────────────────────────

  describe("push_pull_imbalance", () => {
    it("fires when press volume heavily outpaces pull volume over 14 days", () => {
      const insights = buildInsights(
        emptyInput({
          strengthSessions: [
            makeStrengthSession("2026-04-01", [
              makeStrengthSet({
                exerciseName: "Barbell Bench Press",
                weight: 150,
                reps: 10,
                setNumber: 1,
              }),
              makeStrengthSet({
                exerciseName: "Barbell Bench Press",
                weight: 150,
                reps: 10,
                setNumber: 2,
              }),
            ]),
            makeStrengthSession("2026-04-02", [
              makeStrengthSet({
                exerciseName: "Barbell Row",
                weight: 50,
                reps: 10,
                setNumber: 1,
              }),
            ]),
          ],
          now: TEST_NOW,
        }),
      );
      const insight = insights.find(
        (i) => i.insightType === "push_pull_imbalance",
      );
      expect(insight).toBeDefined();
      expect(insight?.title).toMatch(/pressing/i);
    });

    it("does not fire when combined volume is too small to be meaningful", () => {
      const insights = buildInsights(
        emptyInput({
          strengthSessions: [
            makeStrengthSession("2026-04-01", [
              makeStrengthSet({
                exerciseName: "Barbell Bench Press",
                weight: 50,
                reps: 5,
                setNumber: 1,
              }),
            ]),
          ],
          now: TEST_NOW,
        }),
      );
      expect(
        insights.find((i) => i.insightType === "push_pull_imbalance"),
      ).toBeUndefined();
    });

    it("does not fire when push and pull volume are roughly balanced", () => {
      const insights = buildInsights(
        emptyInput({
          strengthSessions: [
            makeStrengthSession("2026-04-01", [
              makeStrengthSet({
                exerciseName: "Barbell Bench Press",
                weight: 150,
                reps: 10,
                setNumber: 1,
              }),
            ]),
            makeStrengthSession("2026-04-02", [
              makeStrengthSet({
                exerciseName: "Barbell Row",
                weight: 145,
                reps: 10,
                setNumber: 1,
              }),
            ]),
          ],
          now: TEST_NOW,
        }),
      );
      expect(
        insights.find((i) => i.insightType === "push_pull_imbalance"),
      ).toBeUndefined();
    });
  });

  // ── Rule: deload_suggested ───────────────────────────────────────────────

  describe("deload_suggested", () => {
    function makeRecoveryCheckin(
      checkinDate: string,
      readinessLevel: number,
    ): RecoveryCheckin {
      return {
        id: `recovery-${checkinDate}`,
        userId,
        checkinDate,
        restingHeartRate: null,
        hrv: null,
        sleepDurationMinutes: null,
        sleepQuality: null,
        energyLevel: null,
        readinessLevel,
        stressLevel: null,
        sorenessLevel: null,
        alcoholCount: 0,
        notes: null,
        timeInBedMinutes: null,
        sleepEfficiencyPct: null,
        deepSleepMinutes: null,
        remSleepMinutes: null,
        coreSleepMinutes: null,
        awakeMinutes: null,
        sleepRespiratoryRate: null,
        sleepSpo2AvgPct: null,
        sleepHrvAvg: null,
        sleepAvgHeartRate: null,
        bedtimeLocal: null,
        wakeTimeLocal: null,
        coldPlungeCompleted: null,
        source: manualSource(),
        createdAt: `${checkinDate}T08:00:00.000Z`,
        updatedAt: `${checkinDate}T08:00:00.000Z`,
        deletedAt: null,
      };
    }

    it("fires after 3 consistent training weeks combined with a readiness decline", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [
            makeWeeklyReview("2026-03-30", { liftsCompleted: 3 }),
            makeWeeklyReview("2026-03-23", { liftsCompleted: 3 }),
            makeWeeklyReview("2026-03-16", { liftsCompleted: 4 }),
          ],
          recoveryCheckins: [
            makeRecoveryCheckin("2026-04-04", 4),
            makeRecoveryCheckin("2026-04-03", 4),
            makeRecoveryCheckin("2026-04-02", 5),
            makeRecoveryCheckin("2026-03-28", 8),
            makeRecoveryCheckin("2026-03-27", 7),
            makeRecoveryCheckin("2026-03-26", 8),
          ],
          now: TEST_NOW,
        }),
      );
      expect(
        insights.find((i) => i.insightType === "deload_suggested"),
      ).toBeDefined();
    });

    it("does not fire without 3 consecutive high-volume training weeks", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [
            makeWeeklyReview("2026-03-30", { liftsCompleted: 1 }),
            makeWeeklyReview("2026-03-23", { liftsCompleted: 3 }),
            makeWeeklyReview("2026-03-16", { liftsCompleted: 4 }),
          ],
          recoveryCheckins: [
            makeRecoveryCheckin("2026-04-04", 4),
            makeRecoveryCheckin("2026-04-03", 4),
            makeRecoveryCheckin("2026-04-02", 5),
            makeRecoveryCheckin("2026-03-28", 8),
            makeRecoveryCheckin("2026-03-27", 7),
            makeRecoveryCheckin("2026-03-26", 8),
          ],
          now: TEST_NOW,
        }),
      );
      expect(
        insights.find((i) => i.insightType === "deload_suggested"),
      ).toBeUndefined();
    });
  });

  // ── Rule: cardio_target_consistently_exceeded ───────────────────────────

  describe("cardio_target_consistently_exceeded", () => {
    it("fires (positive) after 3 straight weeks of exceeding the cardio target", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [
            makeWeeklyReview("2026-03-30", { ridesCompleted: 4 }),
            makeWeeklyReview("2026-03-23", { ridesCompleted: 5 }),
            makeWeeklyReview("2026-03-16", { ridesCompleted: 4 }),
          ],
          now: TEST_NOW,
        }),
      );
      const insight = insights.find(
        (i) => i.insightType === "cardio_target_consistently_exceeded",
      );
      expect(insight).toBeDefined();
      expect(insight?.severity).toBe("positive");
    });

    it("does not fire when any of the last 3 weeks only hits the target instead of exceeding it", () => {
      const insights = buildInsights(
        emptyInput({
          weeklyReviews: [
            makeWeeklyReview("2026-03-30", { ridesCompleted: 3 }),
            makeWeeklyReview("2026-03-23", { ridesCompleted: 5 }),
            makeWeeklyReview("2026-03-16", { ridesCompleted: 4 }),
          ],
          now: TEST_NOW,
        }),
      );
      expect(
        insights.find(
          (i) => i.insightType === "cardio_target_consistently_exceeded",
        ),
      ).toBeUndefined();
    });
  });
});
