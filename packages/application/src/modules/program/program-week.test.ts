import { describe, expect, it } from "vitest";
import type { TrainingProgram, TrainingTemplate } from "@fitness-app/domain";
import { v21Program, withGate } from "./program-fixtures.test-helpers";
import {
  datesBetween,
  loadProgramWeekTargets,
  programWeekTargets,
} from "./program-week";
import type { DatedKneeCheck } from "./program-service";
import {
  loadWeekSchedule,
  templateWeekSchedule,
} from "../weekly-reviews/plan-adherence";

const WEEK_9 = { startDate: "2026-10-19", endDate: "2026-10-25" };
const WEEK_10 = { startDate: "2026-10-26", endDate: "2026-11-01" };

function fakeProgramService(
  program: TrainingProgram | null,
  checks: DatedKneeCheck[] = [],
) {
  return {
    getActiveProgram: async () => program,
    listSettings: async () => [],
    listKneeChecks: async (_u: string, start: string, end: string) =>
      checks.filter((c) => c.date >= start && c.date <= end),
  };
}

const kneeOff = (date: string): DatedKneeCheck => ({
  date,
  swelling: "1+",
  graftPain: 5,
  extensionFull: false,
});

/** Templates summing to the 95 Zone 2 minutes the template plan carried. */
const templates = [
  { templateType: "strength", scheduledDayOfWeek: 1, definition: {} },
  { templateType: "strength", scheduledDayOfWeek: 3, definition: {} },
  { templateType: "strength", scheduledDayOfWeek: 5, definition: {} },
  {
    templateType: "cardio",
    scheduledDayOfWeek: 2,
    definition: { targetZone2Minutes: 45 },
  },
  {
    templateType: "cardio",
    scheduledDayOfWeek: 6,
    definition: { targetZone2Minutes: 50 },
  },
] as unknown as TrainingTemplate[];

const templateService = {
  listActiveStrengthTemplates: async () =>
    templates.filter((t) => t.templateType === "strength"),
  listActiveCardioTemplates: async () =>
    templates.filter((t) => t.templateType === "cardio"),
};

const query = (range: { startDate: string; endDate: string }) => ({
  userId: "u",
  ...range,
});

describe("programWeekTargets", () => {
  it("counts visible lifts and rides; Zone 2 is the Zone 2 rides' top minutes", () => {
    expect(
      programWeekTargets([
        { type: "lift", visible: true, ride: null },
        { type: "lift", visible: false, ride: null },
        { type: "accessory", visible: true, ride: null },
        {
          type: "peloton",
          visible: true,
          ride: { kind: "zone2", minutesMax: 45 },
        },
        {
          type: "peloton",
          visible: true,
          ride: { kind: "climb_intervals", minutesMax: 45 },
        },
        {
          type: "peloton",
          visible: false,
          ride: { kind: "zone2", minutesMax: 60 },
        },
      ]),
    ).toEqual({
      liftsScheduled: 1,
      cardioScheduled: 2,
      zone2TargetMinutes: 45,
    });
  });
});

describe("loadProgramWeekTargets", () => {
  it("week 9 (all Zone 2 rides): 3 lifts, 3 rides, 150 min", async () => {
    const out = await loadProgramWeekTargets(
      fakeProgramService(v21Program()),
      query(WEEK_9),
    );
    expect(out).toEqual({
      liftsScheduled: 3,
      cardioScheduled: 3,
      zone2TargetMinutes: 150,
    });
  });

  it("week 10 (Thursday intervals): 105 min", async () => {
    const out = await loadProgramWeekTargets(
      fakeProgramService(v21Program()),
      query(WEEK_10),
    );
    expect(out).toEqual({
      liftsScheduled: 3,
      cardioScheduled: 3,
      zone2TargetMinutes: 105,
    });
  });

  it("applies the week's knee checks the way the dashboard does", async () => {
    // Knee day off on the interval day: the ride becomes Zone 2.
    const out = await loadProgramWeekTargets(
      fakeProgramService(v21Program(), [kneeOff("2026-10-29")]),
      query(WEEK_10),
    );
    expect(out?.zone2TargetMinutes).toBe(150);
  });

  it("shortens the ride after a walk-jog once the jog gate is cleared", async () => {
    const out = await loadProgramWeekTargets(
      fakeProgramService(withGate(v21Program(), "jog", "2026-10-01")),
      query(WEEK_10),
    );
    // Tuesday's ride drops to 20 min (settings default) + Saturday 60.
    expect(out?.zone2TargetMinutes).toBe(80);
  });

  it("is null without a program, or for a week no block covers", async () => {
    expect(
      await loadProgramWeekTargets(fakeProgramService(null), query(WEEK_9)),
    ).toBeNull();
    expect(
      await loadProgramWeekTargets(
        fakeProgramService(v21Program()),
        query({ startDate: "2026-09-14", endDate: "2026-09-20" }),
      ),
    ).toBeNull();
  });
});

describe("loadWeekSchedule", () => {
  it("uses the program, not the templates, for a week the program covers", async () => {
    expect(templateWeekSchedule(templates).zone2TargetMinutes).toBe(95);
    const out = await loadWeekSchedule(
      {
        programService: fakeProgramService(v21Program()),
        trainingTemplateService: templateService,
      },
      query(WEEK_9),
    );
    expect(out).toEqual({
      liftsScheduled: 3,
      cardioScheduled: 3,
      zone2TargetMinutes: 150,
    });
  });

  it("falls back to the templates when no active program covers the week", async () => {
    const expected = {
      liftsScheduled: 3,
      cardioScheduled: 2,
      zone2TargetMinutes: 95,
    };
    expect(
      await loadWeekSchedule(
        {
          programService: fakeProgramService(null),
          trainingTemplateService: templateService,
        },
        query(WEEK_9),
      ),
    ).toEqual(expected);
    expect(
      await loadWeekSchedule(
        {
          programService: fakeProgramService(v21Program()),
          trainingTemplateService: templateService,
        },
        query({ startDate: "2026-09-14", endDate: "2026-09-20" }),
      ),
    ).toEqual(expected);
  });

  it("lets a program load error through instead of using the templates", async () => {
    await expect(
      loadWeekSchedule(
        {
          programService: {
            ...fakeProgramService(null),
            getActiveProgram: async () => {
              throw new Error("db down");
            },
          },
          trainingTemplateService: templateService,
        },
        query(WEEK_9),
      ),
    ).rejects.toThrow("db down");
  });
});

describe("datesBetween", () => {
  it("lists the week inclusive", () => {
    expect(datesBetween("2026-10-19", "2026-10-25")).toHaveLength(7);
  });
});
