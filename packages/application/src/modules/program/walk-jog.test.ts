import { describe, expect, it } from "vitest";
import { walkJogAdvice, walkJogStageOf } from "./walk-jog";

const run = (date: string, runMinutes: number, walkMinutes: number) => ({
  date,
  runMinutes,
  walkMinutes,
});

describe("walk-jog stage ladder", () => {
  const today = "2026-11-07";

  it("starts at 1:1 x 6", () => {
    expect(walkJogAdvice({ runs: [], checks: [], today })).toMatchObject({
      action: "start",
      stage: 0,
      runMinutesMin: 6,
      structure: "1 min jog / 1 min walk x 6",
    });
  });

  it("reads the stage back from logged run and walk minutes", () => {
    expect(walkJogStageOf(run(today, 6, 6))).toBe(0);
    expect(walkJogStageOf(run(today, 12, 6))).toBe(1);
    expect(walkJogStageOf(run(today, 15, 5))).toBe(2);
    expect(walkJogStageOf(run(today, 20, 4))).toBe(3);
    expect(walkJogStageOf(run(today, 10, 0))).toBe(4);
    expect(walkJogStageOf(run(today, 15, 0))).toBe(5);
    expect(walkJogStageOf(run(today, 20, 0))).toBe(6);
    expect(walkJogStageOf(run(today, 30, 0))).toBe(7);
    // A cut-short run counts as the stage it completed.
    expect(walkJogStageOf(run(today, 13, 6))).toBe(1);
  });

  it("advances exactly one stage per session after a normal morning", () => {
    const ladder = [
      [6, 6, "2 min jog / 1 min walk x 6"],
      [12, 6, "3 min jog / 1 min walk x 5"],
      [15, 5, "5 min jog / 1 min walk x 4"],
      [20, 4, "10 min continuous"],
      [10, 0, "15 min continuous"],
      [15, 0, "20 min continuous"],
      [20, 0, "30 min continuous"],
    ] as const;
    for (const [runMin, walkMin, next] of ladder) {
      expect(
        walkJogAdvice({
          runs: [run("2026-11-03", runMin, walkMin)],
          checks: [{ date: "2026-11-04", status: "normal" }],
          today,
        }).structure,
      ).toBe(next);
    }
  });

  it("tops out at 30 min continuous", () => {
    expect(
      walkJogAdvice({
        runs: [run("2026-11-03", 30, 0)],
        checks: [{ date: "2026-11-04", status: "normal" }],
        today,
      }),
    ).toMatchObject({ stage: 7, runMinutesMin: 30 });
  });

  it("repeats the stage when there is no knee check since the run", () => {
    expect(
      walkJogAdvice({ runs: [run("2026-11-03", 12, 6)], checks: [], today }),
    ).toMatchObject({ action: "run", stage: 1 });
  });

  it("bikes 2 days after a non-normal morning, then goes one stage back", () => {
    const runs = [run("2026-11-03", 12, 6)];
    const checks = [{ date: "2026-11-04", status: "hold" as const }];
    expect(walkJogAdvice({ runs, checks, today: "2026-11-05" })).toMatchObject({
      action: "rest",
      resumeOn: "2026-11-07",
    });
    expect(walkJogAdvice({ runs, checks, today: "2026-11-06" }).action).toBe(
      "rest",
    );
    expect(walkJogAdvice({ runs, checks, today: "2026-11-07" })).toMatchObject({
      action: "run",
      stage: 0,
      structure: "1 min jog / 1 min walk x 6",
    });
  });

  it("steps back across phases and never below the first stage", () => {
    expect(
      walkJogAdvice({
        runs: [run("2026-11-01", 10, 0)],
        checks: [{ date: "2026-11-02", status: "knee_off" }],
        today,
      }).structure,
    ).toBe("5 min jog / 1 min walk x 4");
    expect(
      walkJogAdvice({
        runs: [run("2026-11-01", 6, 6)],
        checks: [{ date: "2026-11-02", status: "knee_off" }],
        today,
      }).stage,
    ).toBe(0);
  });

  it("ignores a run logged today", () => {
    expect(
      walkJogAdvice({ runs: [run(today, 6, 6)], checks: [], today }).action,
    ).toBe("start");
  });
});
