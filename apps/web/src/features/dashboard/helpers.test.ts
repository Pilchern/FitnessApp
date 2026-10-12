import { describe, expect, it } from "vitest";
// Imported by path rather than via "@fitness-app/application": apps/web has no
// vitest config, so workspace package aliases only resolve in the Next build.
// This is the exact helper server.ts uses to build the zoned clock.
import { getZonedDate } from "../../../../../packages/application/src/shared/timezone";
import {
  buildWeekPlan,
  formatZonedIsoDate,
  readinessCall,
  summarizeDailyActivity,
} from "./helpers";

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
});

describe("buildWeekPlan", () => {
  const templates = [
    {
      id: "push",
      name: "Mon Push",
      templateType: "strength" as const,
      scheduledDayOfWeek: 1,
      definition: {},
    },
    {
      id: "z2-tue",
      name: "Tue Bike Z2",
      templateType: "cardio" as const,
      scheduledDayOfWeek: 2,
      definition: { targetZone2Minutes: 30 },
    },
    {
      id: "z2-sat",
      name: "Sat Bike Z2",
      templateType: "cardio" as const,
      scheduledDayOfWeek: 6,
      definition: { targetZone2Minutes: 45 },
    },
    {
      id: "unscheduled",
      name: "No day",
      templateType: "strength" as const,
      scheduledDayOfWeek: null,
      definition: {},
    },
  ];
  // 2026-10-05 is a Monday.
  const base = {
    weekStart: "2026-10-05",
    today: "2026-10-07",
    templates,
    strengthSessions: [],
    cardioSessions: [],
  };

  it("lays templates on the right dates and sums the Z2 target", () => {
    const plan = buildWeekPlan(base);
    expect(plan.days).toHaveLength(7);
    expect(plan.days[0]?.date).toBe("2026-10-05");
    expect(plan.days[0]?.items.map((i) => i.templateId)).toEqual(["push"]);
    expect(plan.days[1]?.items.map((i) => i.templateId)).toEqual(["z2-tue"]);
    expect(plan.days[5]?.items.map((i) => i.templateId)).toEqual(["z2-sat"]);
    expect(plan.zone2TargetMinutes).toBe(75);
  });

  it("ignores templates with no scheduled day", () => {
    const all = buildWeekPlan(base).days.flatMap((d) => d.items);
    expect(all.some((i) => i.templateId === "unscheduled")).toBe(false);
  });

  it("flags today and past days", () => {
    const plan = buildWeekPlan(base);
    expect(plan.days[2]?.isToday).toBe(true);
    expect(plan.days[1]?.isPast).toBe(true);
    expect(plan.days[3]?.isPast).toBe(false);
  });

  it("marks strength done by template id or by date when untemplated", () => {
    const byTemplate = buildWeekPlan({
      ...base,
      strengthSessions: [
        { sessionDate: "2026-10-05", trainingTemplateId: "push" },
      ],
    });
    expect(byTemplate.days[0]?.items[0]?.done).toBe(true);

    const byDate = buildWeekPlan({
      ...base,
      strengthSessions: [
        { sessionDate: "2026-10-05", trainingTemplateId: null },
      ],
    });
    expect(byDate.days[0]?.items[0]?.done).toBe(true);

    const otherTemplate = buildWeekPlan({
      ...base,
      strengthSessions: [
        { sessionDate: "2026-10-05", trainingTemplateId: "other" },
      ],
    });
    expect(otherTemplate.days[0]?.items[0]?.done).toBe(false);
  });

  it("does not count planned-only or non-cardio rows as done", () => {
    const plan = buildWeekPlan({
      ...base,
      cardioSessions: [
        {
          sessionDate: "2026-10-06",
          trainingTemplateId: null,
          plannedVsCompleted: "planned",
          sessionKind: "zone2",
        },
        {
          sessionDate: "2026-10-06",
          trainingTemplateId: null,
          plannedVsCompleted: "completed",
          sessionKind: "other",
        },
      ],
    });
    expect(plan.days[1]?.items[0]?.done).toBe(false);

    const done = buildWeekPlan({
      ...base,
      cardioSessions: [
        {
          sessionDate: "2026-10-06",
          trainingTemplateId: "z2-tue",
          plannedVsCompleted: "completed",
          sessionKind: "zone2",
        },
      ],
    });
    expect(done.days[1]?.items[0]?.done).toBe(true);
  });

  it("counts a moved session toward the earliest missed slot before it", () => {
    const plan = buildWeekPlan({
      ...base,
      today: "2026-10-11",
      // Monday's lift done Tuesday; Tuesday's ride done Wednesday.
      strengthSessions: [
        { sessionDate: "2026-10-06", trainingTemplateId: null },
      ],
      cardioSessions: [
        {
          sessionDate: "2026-10-07",
          trainingTemplateId: null,
          plannedVsCompleted: "completed",
          sessionKind: "zone2",
        },
      ],
    });
    expect(plan.days[0]?.items[0]?.done).toBe(true);
    expect(plan.days[1]?.items[0]?.done).toBe(true);
    expect(plan.days[5]?.items[0]?.done).toBe(false);
  });

  it("never credits a slot later than the session or outside the week", () => {
    const plan = buildWeekPlan({
      ...base,
      cardioSessions: [
        {
          sessionDate: "2026-10-05",
          trainingTemplateId: null,
          plannedVsCompleted: "completed",
          sessionKind: "zone2",
        },
        {
          sessionDate: "2026-10-12",
          trainingTemplateId: null,
          plannedVsCompleted: "completed",
          sessionKind: "zone2",
        },
      ],
    });
    expect(plan.days[1]?.items[0]?.done).toBe(false);
    expect(plan.days[5]?.items[0]?.done).toBe(false);
  });
});

describe("summarizeDailyActivity", () => {
  const metric = (
    metricDate: string,
    steps: number | null,
    vo2Max: number | null,
  ) => ({
    metricDate,
    steps,
    vo2Max,
  });

  it("returns today's steps and the latest VO2 max with its date", () => {
    expect(
      summarizeDailyActivity(
        [
          metric("2026-10-09", 5400, null),
          metric("2026-10-01", 9100, 40.2),
          metric("2026-06-01", 8000, 39.7),
        ],
        "2026-10-09",
      ),
    ).toEqual({
      stepsToday: 5400,
      vo2Max: { value: 40.2, date: "2026-10-01" },
    });
  });

  it("is null before anything syncs", () => {
    expect(summarizeDailyActivity([], "2026-10-09")).toEqual({
      stepsToday: null,
      vo2Max: null,
    });
  });
});

describe("readinessCall", () => {
  const lift = { kind: "strength" as const, done: false };
  const ride = { kind: "cardio" as const, done: false };

  it("tells a good day to train and progress load", () => {
    expect(readinessCall("good", [lift])).toMatch(/^Good day to lift/);
    expect(readinessCall("good", [ride])).toBe("Ride as planned.");
  });

  it("holds load on a fair day and trims accessories on a low one", () => {
    expect(readinessCall("fair", [lift])).toMatch(
      /keep weights where they were/,
    );
    expect(readinessCall("low", [lift])).toMatch(/cut the accessories/);
    expect(readinessCall("low", [ride])).toBe(
      "Keep the ride short and easy, or rest.",
    );
  });

  it("handles rest days, finished sessions and no score", () => {
    expect(readinessCall("low", [])).toBe("Rest day. Protect tonight's sleep.");
    expect(readinessCall("good", [{ ...lift, done: true }])).toBe(
      "Today's session is done. Recover well tonight.",
    );
    expect(readinessCall(null, [ride])).toBe("Ride as planned.");
    expect(readinessCall(null, [])).toBe("Nothing scheduled today.");
  });
});
