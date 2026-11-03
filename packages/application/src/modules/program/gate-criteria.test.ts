import { describe, expect, it } from "vitest";
import type { KneeTest, ProgramGate } from "@fitness-app/domain";
import { gateBoards, type GateInputs } from "./gate-criteria";

const t = (
  testDate: string,
  testType: string,
  side: "L" | "R" | null,
  value: number,
  repIndex = 1,
): KneeTest => ({
  testDate,
  testType,
  side,
  value,
  unit: "x",
  repIndex,
  source: "fitness_app",
  notes: null,
});

const gate = (
  gateKey: string,
  over: Partial<ProgramGate> = {},
): ProgramGate => ({
  id: `00000000-0000-4000-8000-00000000000${gateKey.length}`,
  gateKey,
  label: gateKey,
  clearedOn: null,
  earliestOn: null,
  notes: null,
  ...over,
});

const today = "2026-11-08";
const checks = ["2026-11-06", "2026-11-07", "2026-11-08"].map((date) => ({
  date,
  swelling: "trace" as const,
  graftPain: 1,
  extensionFull: true,
}));

function boards(over: Partial<GateInputs> = {}) {
  return gateBoards({
    tests: [],
    checks,
    gates: [
      gate("jog", { earliestOn: "2026-10-26" }),
      gate("plyo_double", { earliestOn: "2026-11-09" }),
      gate("rts", { earliestOn: "2027-05-17" }),
    ],
    today,
    lsiTargets: [70, 80, 90],
    walkingAsymmetryTargetPct: 5,
    ...over,
  });
}

const state = (b: ReturnType<typeof boards>, board: string, key: string) =>
  b.find((x) => x.key === board)?.criteria.find((c) => c.key === key)?.state;

describe("gateBoards", () => {
  it("judges the jog gate from crane tests, knee checks and walking", () => {
    const b = boards({
      tests: [
        t("2026-11-08", "quad_iso_90", "L", 300),
        t("2026-11-08", "quad_iso_90", "R", 400),
        t("2026-11-08", "heel_to_butt", "L", 12),
        t("2026-11-08", "heel_to_butt", "R", 10.5),
        t("2026-11-08", "walking_asymmetry", null, 6),
      ],
    });
    expect(state(b, "jog", "quad_lsi")).toBe("pass");
    expect(state(b, "jog", "extension")).toBe("pass");
    expect(state(b, "jog", "flexion")).toBe("pass");
    expect(state(b, "jog", "swelling")).toBe("pass");
    expect(state(b, "jog", "graft")).toBe("pass");
    expect(state(b, "jog", "walk_asym")).toBe("fail");
    expect(state(b, "jog", "date")).toBe("pass");
    expect(b[0]?.status).toBe("not_yet");
  });

  it("marks old measurements stale and short check runs missing", () => {
    const b = boards({
      tests: [
        t("2026-10-01", "quad_iso_90", "L", 400),
        t("2026-10-01", "quad_iso_90", "R", 400),
      ],
      checks: checks.slice(0, 2),
    });
    expect(state(b, "jog", "quad_lsi")).toBe("stale");
    expect(state(b, "jog", "swelling")).toBe("missing");
    expect(state(b, "plyo", "date")).toBe("fail");
  });

  it("fails swelling when any of the last three is above trace", () => {
    const b = boards({
      checks: [...checks.slice(0, 2), { ...checks[2]!, swelling: "1+" }],
    });
    expect(state(b, "jog", "swelling")).toBe("fail");
  });

  it("reads timed hops with faster as better and reports cleared gates", () => {
    const b = boards({
      tests: [
        t("2026-11-08", "hop_6m_timed", "L", 2.5),
        t("2026-11-08", "hop_6m_timed", "L", 2.2, 2),
        t("2026-11-08", "hop_6m_timed", "R", 2.0),
      ],
      gates: [gate("jog", { clearedOn: "2026-11-01", clearedBy: "pt" })],
    });
    const timed = b
      .find((x) => x.key === "rts")
      ?.criteria.find((c) => c.key === "hop_6m_timed");
    expect(timed?.detail).toBe("90.9%");
    expect(timed?.state).toBe("pass");
    expect(b[0]?.status).toBe("cleared");
    expect(b[0]?.criteria.at(-1)?.detail).toBe("2026-11-01 by PT");
  });

  it("is ready when every criterion but clearance passes", () => {
    const b = boards({
      tests: [
        t("2026-11-08", "quad_iso_90", "L", 330),
        t("2026-11-08", "quad_iso_90", "R", 400),
        t("2026-11-08", "step_down", "L", 1),
        t("2026-11-08", "single_leg_sit_to_stand", "L", 9),
        t("2026-11-08", "single_leg_sit_to_stand", "R", 10),
      ],
      gates: [gate("plyo_double", { earliestOn: "2026-11-08" })],
    });
    expect(b.find((x) => x.key === "plyo")?.status).toBe("ready");
  });
});
