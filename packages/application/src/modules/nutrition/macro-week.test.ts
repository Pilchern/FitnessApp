import { describe, expect, it } from "vitest";
import { macroWeek } from "../../index";

const day = (
  logDate: string,
  calories: number | null,
  proteinGrams: number | null,
  rest: { netCarbsGrams?: number; fatGrams?: number; fiberGrams?: number } = {},
) => ({
  logDate,
  calories,
  proteinGrams,
  netCarbsGrams: rest.netCarbsGrams ?? null,
  fatGrams: rest.fatGrams ?? null,
  fiberGrams: rest.fiberGrams ?? null,
});

const targets = {
  calories: 2450,
  proteinGrams: 200,
  netCarbsGrams: 255,
  fatGrams: 70,
  fiberGrams: 38,
};

describe("macroWeek", () => {
  it("averages each macro over the days that have it, against the targets", () => {
    const week = macroWeek(
      [
        day("2026-11-01", 2400, 190, {
          netCarbsGrams: 250,
          fatGrams: 72,
          fiberGrams: 35,
        }),
        day("2026-11-03", 2500, 210, { netCarbsGrams: 260 }),
        day("2026-11-04", null, 180),
        day("2026-10-25", 4000, 50), // outside the 7 days
      ],
      "2026-11-07",
      targets,
    );
    expect(week.start).toBe("2026-11-01");
    expect(week.daysLogged).toBe(2);
    const by = Object.fromEntries(week.macros.map((m) => [m.key, m]));
    expect(by.calories).toMatchObject({
      avg: 2450,
      daysWithValue: 2,
      target: 2450,
    });
    expect(by.proteinGrams).toMatchObject({
      avg: 193,
      daysWithValue: 3,
      target: 200,
    });
    expect(by.netCarbsGrams).toMatchObject({ avg: 255, target: 255 });
    expect(by.fatGrams).toMatchObject({ avg: 72, daysWithValue: 1 });
    expect(by.fiberGrams).toMatchObject({ avg: 35, target: 38 });
  });

  it("has no averages with nothing logged", () => {
    const week = macroWeek([], "2026-11-07", {});
    expect(week.daysLogged).toBe(0);
    expect(week.macros.every((m) => m.avg == null && m.target == null)).toBe(
      true,
    );
  });
});
