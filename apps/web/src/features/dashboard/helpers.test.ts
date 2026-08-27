import { describe, expect, it } from "vitest";
// Imported by path rather than via "@fitness-app/application": apps/web has no
// vitest config, so workspace package aliases only resolve in the Next build.
// This is the exact helper server.ts uses to build the zoned clock.
import { getZonedDate } from "../../../../../packages/application/src/shared/timezone";
import {
  computeGoalProgress,
  formatZonedIsoDate,
  type GoalProgressBodyMetric,
  type GoalProgressCardioSession,
  type GoalProgressProfile,
  type GoalProgressStrengthSession,
} from "./helpers";

// Fixed clock for every test below. In UTC this instant is 2026-08-26, so:
//   today = 2026-08-26   28d ago = 2026-07-29   30d ago = 2026-07-27
//   56d ago = 2026-07-01  60d ago = 2026-06-27
const NOW = new Date("2026-08-26T15:00:00Z");

function makeProfile(
  overrides: Partial<GoalProgressProfile> = {},
): GoalProgressProfile {
  return {
    goalFatLoss: false,
    goalPreserveMuscle: false,
    goalImproveVo2: false,
    targetWeightLb: null,
    targetDate: null,
    ...overrides,
  };
}

function fatLoss(
  body: GoalProgressBodyMetric[],
  profileOverrides: Partial<GoalProgressProfile> = {},
  zonedNow: Date = NOW,
) {
  const [card] = computeGoalProgress(
    makeProfile({ goalFatLoss: true, ...profileOverrides }),
    body,
    [],
    [],
    { zonedNow },
  );
  return card!;
}

function muscle(sessions: GoalProgressStrengthSession[], zonedNow: Date = NOW) {
  const [card] = computeGoalProgress(
    makeProfile({ goalPreserveMuscle: true }),
    [],
    sessions,
    [],
    { zonedNow },
  );
  return card!;
}

function vo2(sessions: GoalProgressCardioSession[], zonedNow: Date = NOW) {
  const [card] = computeGoalProgress(
    makeProfile({ goalImproveVo2: true }),
    [],
    [],
    sessions,
    { zonedNow },
  );
  return card!;
}

function zone2(
  sessionDate: string,
  minutes: number,
): GoalProgressCardioSession {
  return {
    sessionDate,
    sessionKind: "zone2",
    zone2Minutes: minutes,
    durationMinutes: null,
  };
}

function lift(
  sessionDate: string,
  volume: number,
): GoalProgressStrengthSession {
  return { sessionDate, sets: [{ weight: volume / 10, reps: 10 }] };
}

describe("computeGoalProgress", () => {
  it("returns nothing without a profile", () => {
    expect(computeGoalProgress(null, [], [], [], { zonedNow: NOW })).toEqual(
      [],
    );
  });

  it("returns one card per enabled goal, in order", () => {
    const cards = computeGoalProgress(
      makeProfile({
        goalFatLoss: true,
        goalPreserveMuscle: true,
        goalImproveVo2: true,
      }),
      [],
      [],
      [],
      { zonedNow: NOW },
    );
    expect(cards.map((c) => c.label)).toEqual([
      "Fat loss",
      "Preserve muscle",
      "Improve VO2",
    ]);
  });

  it("omits cards for disabled goals", () => {
    const cards = computeGoalProgress(
      makeProfile({ goalImproveVo2: true }),
      [{ measuredOn: "2026-08-26", weightLb: 190 }],
      [lift("2026-08-20", 1000)],
      [],
      { zonedNow: NOW },
    );
    expect(cards.map((c) => c.label)).toEqual(["Improve VO2"]);
  });
});

describe("fat loss goal", () => {
  it("reports insufficient data with no weigh-ins at all", () => {
    expect(fatLoss([])).toMatchObject({
      trend: "insufficient_data",
      trendDetail: "Not enough data yet — keep logging",
    });
  });

  it("reports insufficient data when no weigh-in predates the 28-day cutoff", () => {
    expect(
      fatLoss([
        { measuredOn: "2026-08-26", weightLb: 196 },
        { measuredOn: "2026-08-10", weightLb: 198 },
      ]),
    ).toMatchObject({ trend: "insufficient_data" });
  });

  it("ignores weigh-ins with no weight recorded", () => {
    expect(
      fatLoss([
        { measuredOn: "2026-08-26", weightLb: null },
        { measuredOn: "2026-07-29", weightLb: null },
      ]),
    ).toMatchObject({ trend: "insufficient_data" });
  });

  it("describes the trend when no target weight is set", () => {
    expect(
      fatLoss([
        { measuredOn: "2026-08-26", weightLb: 196 },
        { measuredOn: "2026-07-29", weightLb: 199 },
      ]),
    ).toMatchObject({
      description: "Trending body weight down over time",
      trend: "improving",
      trendDetail: "down 3.0lb in 4 weeks",
    });
  });

  it("flags a gaining trend as declining", () => {
    expect(
      fatLoss([
        { measuredOn: "2026-08-26", weightLb: 201 },
        { measuredOn: "2026-07-29", weightLb: 199 },
      ]),
    ).toMatchObject({ trend: "declining", trendDetail: "up 2.0lb in 4 weeks" });
  });

  it("calls a flat trend maintaining", () => {
    expect(
      fatLoss([
        { measuredOn: "2026-08-26", weightLb: 199.2 },
        { measuredOn: "2026-07-29", weightLb: 199 },
      ]),
    ).toMatchObject({ trend: "maintaining" });
  });

  it("celebrates a target that has been met", () => {
    expect(
      fatLoss(
        [
          { measuredOn: "2026-08-26", weightLb: 188 },
          { measuredOn: "2026-07-29", weightLb: 199 },
        ],
        { targetWeightLb: 190 },
      ),
    ).toMatchObject({
      description: "Target weight: 190lb",
      trend: "improving",
      trendDetail: "At or below target (188lb)",
    });
  });

  it("reports on pace when the recent rate clears the required rate", () => {
    // -4lb over the 4 weeks since baseline = 1.0 lb/wk; 6lb to go in ~8 weeks
    // needs ~0.75 lb/wk.
    expect(
      fatLoss(
        [
          { measuredOn: "2026-08-26", weightLb: 196 },
          { measuredOn: "2026-07-29", weightLb: 200 },
        ],
        { targetWeightLb: 190, targetDate: "2026-10-21" },
      ),
    ).toMatchObject({
      trend: "improving",
      trendDetail: "6.0lb to go — on pace for 2026-10-21",
    });
  });

  it("reports behind pace when the recent rate falls short", () => {
    expect(
      fatLoss(
        [
          { measuredOn: "2026-08-26", weightLb: 199 },
          { measuredOn: "2026-07-29", weightLb: 200 },
        ],
        { targetWeightLb: 190, targetDate: "2026-10-21" },
      ),
    ).toMatchObject({
      trendDetail: "9.0lb to go — behind pace for 2026-10-21",
    });
  });

  it("says so when the target date has already passed", () => {
    expect(
      fatLoss(
        [
          { measuredOn: "2026-08-26", weightLb: 196 },
          { measuredOn: "2026-07-29", weightLb: 200 },
        ],
        { targetWeightLb: 190, targetDate: "2026-08-01" },
      ),
    ).toMatchObject({
      trendDetail: "6.0lb to go — target date (2026-08-01) has passed",
    });
  });

  // BUG (b): the pace math divided the weight delta by a hardcoded 4 weeks.
  // The baseline is only "the most recent weigh-in at or before 28 days ago",
  // and the metric list spans 90 days — here the baseline is 85 days (12.1
  // weeks) old. OLD BEHAVIOR: 4lb / 4 weeks = 1.0 lb/wk >= the 0.75 lb/wk
  // required, so the card said "on pace" to someone losing 0.33 lb/wk.
  it("divides the weight delta by the real baseline span, not a fixed 4 weeks", () => {
    expect(
      fatLoss(
        [
          { measuredOn: "2026-08-26", weightLb: 196 },
          { measuredOn: "2026-06-02", weightLb: 200 },
        ],
        { targetWeightLb: 190, targetDate: "2026-10-21" },
      ),
    ).toMatchObject({
      trendDetail: "6.0lb to go — behind pace for 2026-10-21",
    });
  });

  // BUG (b), same root cause in the untargeted copy.
  // OLD BEHAVIOR: "down 4.0lb in 4 weeks" for a 12-week-old baseline.
  it("states the real span in the untargeted trend detail", () => {
    expect(
      fatLoss([
        { measuredOn: "2026-08-26", weightLb: 196 },
        { measuredOn: "2026-06-02", weightLb: 200 },
      ]),
    ).toMatchObject({ trendDetail: "down 4.0lb in 12 weeks" });
  });

  it("uses a singular week label for a one-week span", () => {
    expect(
      fatLoss([
        { measuredOn: "2026-08-05", weightLb: 197 },
        { measuredOn: "2026-07-29", weightLb: 199 },
      ]),
    ).toMatchObject({ trendDetail: "down 2.0lb in 1 week" });
  });

  it("refuses to judge pace when baseline and latest are the same weigh-in", () => {
    // Single weigh-in 40 days ago: zero elapsed span, so the rate is undefined
    // rather than a divide-by-zero.
    const card = fatLoss([{ measuredOn: "2026-07-17", weightLb: 200 }], {
      targetWeightLb: 190,
      targetDate: "2026-10-21",
    });
    expect(card.trendDetail).toBe(
      "10.0lb to go — not enough weigh-in history to judge pace for 2026-10-21",
    );
    expect(card.trendDetail).not.toContain("NaN");
    expect(card.trendDetail).not.toContain("Infinity");
  });

  it("omits pace wording entirely when no target date is set", () => {
    expect(
      fatLoss(
        [
          { measuredOn: "2026-08-26", weightLb: 196 },
          { measuredOn: "2026-07-29", weightLb: 200 },
        ],
        { targetWeightLb: 190 },
      ),
    ).toMatchObject({ trendDetail: "6.0lb to go" });
  });
});

describe("preserve muscle goal", () => {
  it("reports insufficient data without a prior month to compare against", () => {
    expect(muscle([lift("2026-08-20", 1000)])).toMatchObject({
      trend: "insufficient_data",
      trendDetail: "Not enough data yet — keep logging",
    });
  });

  it("reports improving when volume is up at least 5%", () => {
    expect(
      muscle([lift("2026-08-20", 1100), lift("2026-07-10", 1000)]),
    ).toMatchObject({
      trend: "improving",
      trendDetail: "volume up 10% vs last month",
    });
  });

  it("reports declining when volume drops more than 10%", () => {
    expect(
      muscle([lift("2026-08-20", 800), lift("2026-07-10", 1000)]),
    ).toMatchObject({
      trend: "declining",
      trendDetail: "volume down 20% vs last month",
    });
  });

  it("reports maintaining for a small swing", () => {
    expect(
      muscle([lift("2026-08-20", 1020), lift("2026-07-10", 1000)]),
    ).toMatchObject({
      trend: "maintaining",
      trendDetail: "volume up 2% vs last month",
    });
  });

  it("counts a session on the month boundary once, in the current month", () => {
    // 2026-07-27 is exactly 30 days back: current month, not the prior one.
    expect(
      muscle([
        lift("2026-08-20", 1000),
        lift("2026-07-27", 1000),
        lift("2026-07-10", 1000),
      ]),
    ).toMatchObject({ trendDetail: "volume up 100% vs last month" });
  });

  it("skips sets with missing weight or reps", () => {
    expect(
      muscle([
        {
          sessionDate: "2026-08-20",
          sets: [
            { weight: 100, reps: 10 },
            { weight: null, reps: 10 },
            { weight: 100, reps: null },
          ],
        },
        lift("2026-07-10", 1000),
      ]),
    ).toMatchObject({ trendDetail: "volume up 0% vs last month" });
  });
});

describe("improve VO2 goal", () => {
  it("reports insufficient data when both windows are empty", () => {
    expect(vo2([])).toMatchObject({
      trend: "insufficient_data",
      trendDetail: "Not enough data yet — keep logging",
    });
  });

  it("reports improving when weekly minutes are up at least 20", () => {
    expect(
      vo2([zone2("2026-08-20", 200), zone2("2026-07-10", 100)]),
    ).toMatchObject({
      trend: "improving",
      trendDetail: "up 25 min/week vs prior 4 weeks",
    });
  });

  it("reports declining when weekly minutes drop by at least 20", () => {
    expect(
      vo2([zone2("2026-08-20", 100), zone2("2026-07-10", 300)]),
    ).toMatchObject({
      trend: "declining",
      trendDetail: "down 50 min/week vs prior 4 weeks",
    });
  });

  it("reports maintaining for a small swing", () => {
    expect(
      vo2([zone2("2026-08-20", 120), zone2("2026-07-10", 100)]),
    ).toMatchObject({
      trend: "maintaining",
      trendDetail: "up 5 min/week vs prior 4 weeks",
    });
  });

  it("counts vo2 sessions and falls back to duration when zone2 minutes are absent", () => {
    expect(
      vo2([
        {
          sessionDate: "2026-08-20",
          sessionKind: "vo2",
          zone2Minutes: null,
          durationMinutes: 200,
        },
        zone2("2026-07-10", 100),
      ]),
    ).toMatchObject({ trendDetail: "up 25 min/week vs prior 4 weeks" });
  });

  it("ignores cardio that is neither zone2 nor vo2", () => {
    expect(
      vo2([
        {
          sessionDate: "2026-08-20",
          sessionKind: "other",
          zone2Minutes: null,
          durationMinutes: 200,
        },
      ]),
    ).toMatchObject({ trend: "insufficient_data" });
  });

  // BUG (a): both windows used `>= from && <= to`, so a session dated exactly
  // on the 4-weeks-ago boundary landed in BOTH the current and the prior
  // window. OLD BEHAVIOR for this single 90-minute ride: this = 90, prior = 90,
  // delta = 0 → "maintaining", "up 0 min/week". The session belongs to the
  // current window only, which is a +22.5 min/week swing.
  it("counts a session on the 4-week boundary once, in the current window", () => {
    expect(vo2([zone2("2026-07-29", 90)])).toMatchObject({
      trend: "improving",
      trendDetail: "up 23 min/week vs prior 4 weeks",
    });
  });

  // BUG (a), with both windows populated.
  // OLD BEHAVIOR: prior = 200 + 90 (boundary double-counted) = 290 → 72.5/wk
  // against 22.5/wk, i.e. "down 50 min/week". The boundary ride belongs to the
  // current window, so the real gap is 22.5 vs 50 = "down 28 min/week".
  it("does not add the boundary day into the prior window", () => {
    expect(
      vo2([zone2("2026-07-29", 90), zone2("2026-07-10", 200)]),
    ).toMatchObject({
      trend: "declining",
      trendDetail: "down 28 min/week vs prior 4 weeks",
    });
  });

  it("excludes sessions older than the 8-week window", () => {
    // 2026-06-30 is one day before the 56-day boundary.
    expect(
      vo2([zone2("2026-08-20", 100), zone2("2026-06-30", 400)]),
    ).toMatchObject({ trendDetail: "up 25 min/week vs prior 4 weeks" });
  });
});

describe("user-local today (timezone consistency)", () => {
  // BUG (c): the dashboard derived `today` from `new Date().toISOString()`,
  // i.e. the UTC date, and handed it to computeJournalStreak — whose first act
  // is `if (!dates.has(today)) return 0`. In America/Chicago the UTC date rolls
  // at 19:00 local, so from 7pm to midnight every evening the dashboard told a
  // user with an unbroken streak that their streak was 0.
  const eveningInChicago = new Date("2026-08-27T01:30:00Z"); // 20:30 on 8/26

  it("uses the user's local calendar date, not the UTC date", () => {
    expect(
      formatZonedIsoDate(getZonedDate("America/Chicago", eveningInChicago)),
    ).toBe("2026-08-26");
    // The old, buggy value:
    expect(eveningInChicago.toISOString().slice(0, 10)).toBe("2026-08-27");
  });

  it("still returns the UTC date for a UTC user", () => {
    expect(formatZonedIsoDate(getZonedDate("UTC", eveningInChicago))).toBe(
      "2026-08-27",
    );
  });

  it("falls back to UTC for an empty timezone", () => {
    expect(formatZonedIsoDate(getZonedDate("", eveningInChicago))).toBe(
      "2026-08-27",
    );
  });

  it("derives goal windows from the user's local day", () => {
    // Same instant, same ride (2026-07-29). For Chicago the local day is
    // 2026-08-26, so the 4-week boundary is 2026-07-29 and the ride is current
    // work. Under UTC the day is 2026-08-27, the boundary is 2026-07-30, and
    // the same ride reads as prior-window work instead.
    const ride = [zone2("2026-07-29", 90)];
    expect(
      vo2(ride, getZonedDate("America/Chicago", eveningInChicago)),
    ).toMatchObject({
      trend: "improving",
      trendDetail: "up 23 min/week vs prior 4 weeks",
    });
    expect(vo2(ride, getZonedDate("UTC", eveningInChicago))).toMatchObject({
      trend: "declining",
      trendDetail: "down 23 min/week vs prior 4 weeks",
    });
  });

  it("derives the fat-loss cutoff from the user's local day", () => {
    // A weigh-in dated 2026-07-29 is exactly 28 days before the Chicago day
    // (usable as a baseline) but only 29 days... before the UTC day, which
    // moves the cutoff to 2026-07-30 and leaves it usable there too — the
    // distinguishing case is a weigh-in dated on the UTC cutoff itself.
    const body: GoalProgressBodyMetric[] = [
      { measuredOn: "2026-08-26", weightLb: 196 },
      { measuredOn: "2026-07-30", weightLb: 200 },
    ];
    // Chicago: cutoff is 2026-07-29, so the 07-30 weigh-in is too recent to be
    // a baseline.
    expect(
      fatLoss(body, {}, getZonedDate("America/Chicago", eveningInChicago)),
    ).toMatchObject({ trend: "insufficient_data" });
    // UTC: cutoff is 2026-07-30, so the same weigh-in qualifies.
    expect(
      fatLoss(body, {}, getZonedDate("UTC", eveningInChicago)),
    ).toMatchObject({ trend: "improving" });
  });
});
