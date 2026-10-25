import { describe, expect, it } from "vitest";
import {
  estimateSessionMinutes,
  groupItems,
  restAfterSet,
  supersetLabel,
  workingSeconds,
  type BudgetItem,
} from "./session-budget";

function item(partial: Partial<BudgetItem> & { name: string }): BudgetItem {
  return {
    sets: 3,
    measure: "reps",
    sideMode: "bilateral",
    category: "accessory",
    secondsTarget: null,
    supersetGroup: null,
    supersetOrder: null,
    ...partial,
  };
}

const pair = (g: string, a: Partial<BudgetItem>, b: Partial<BudgetItem>) => [
  item({ name: `${g}1`, supersetGroup: g, supersetOrder: 1, ...a }),
  item({ name: `${g}2`, supersetGroup: g, supersetOrder: 2, ...b }),
];

/** Block 1 Monday as specified: 4 pairs/items, ~55 min target. */
const block1Monday = [
  ...pair(
    "A",
    { name: "Pin Squat", sets: 4, category: "main" },
    { name: "Lateral Raise", sets: 3 },
  ),
  item({ name: "Cuff Knee Extension", sideMode: "per_leg" }),
  ...pair(
    "C",
    { name: "Hip Thrust", category: "main" },
    { name: "Bench", category: "main" },
  ),
  ...pair(
    "D",
    { name: "Incline DB" },
    { name: "SL Calf Raise", sideMode: "per_leg" },
  ),
];

describe("session time budget", () => {
  it("straight sets: sets x (work 40 s, plyo 15 s, + rest by category)", () => {
    expect(
      workingSeconds([item({ name: "Squat", sets: 4, category: "main" })]),
    ).toBe(4 * (40 + 150));
    expect(workingSeconds([item({ name: "Curl", sets: 2 })])).toBe(
      2 * (40 + 60),
    );
    expect(
      workingSeconds([item({ name: "Pogo", sets: 2, category: "plyo" })]),
    ).toBe(2 * (15 + 60));
  });

  it("per-leg items work both legs and rest once", () => {
    expect(
      workingSeconds([item({ name: "Step-Up", sideMode: "per_leg" })]),
    ).toBe(3 * (80 + 60));
  });

  it("an extra left-leg set adds one side's work and one rest", () => {
    expect(
      workingSeconds([
        item({ name: "Step-Up", sideMode: "per_leg", leftExtraSets: 1 }),
      ]),
    ).toBe(3 * (80 + 60) + (40 + 60));
  });

  it("timed and isometric work uses the hold time", () => {
    expect(
      workingSeconds([
        item({
          name: "Iso",
          sets: 5,
          measure: "force",
          secondsTarget: 5,
          sideMode: "per_leg",
        }),
      ]),
    ).toBe(5 * (10 + 60));
    expect(
      workingSeconds([
        item({ name: "Spanish", measure: "time", secondsTarget: 45 }),
      ]),
    ).toBe(3 * (45 + 60));
  });

  it("a superset rests 90 s after the pair; uneven sets finish alone", () => {
    // 3 rounds of both (40 + 40 + 90), then one round of A1 alone (40 + 90).
    expect(
      workingSeconds(pair("A", { sets: 4, category: "main" }, { sets: 3 })),
    ).toBe(3 * 170 + 130);
  });

  it("a superset with its partner gated off is a straight set", () => {
    expect(
      workingSeconds([
        item({ name: "A2", supersetGroup: "A", supersetOrder: 2, sets: 3 }),
      ]),
    ).toBe(3 * (40 + 60));
  });

  it("lift days add warm-up 5, gait drill 3 and transitions 4", () => {
    // A 640 + B 420 + C 510 + D 630 = 2200 s -> 37 min, + 12.
    expect(
      estimateSessionMinutes({ sessionType: "lift", items: block1Monday }),
    ).toEqual({ minutes: 49, overBudget: false });
  });

  it("flags a lift session over 60 min", () => {
    const heavy = [
      ...block1Monday,
      item({ name: "Extra 1", sets: 4, category: "main" }),
      item({ name: "Extra 2", sets: 4, category: "main" }),
    ];
    const estimate = estimateSessionMinutes({
      sessionType: "lift",
      items: heavy,
    });
    expect(estimate?.minutes).toBeGreaterThan(60);
    expect(estimate?.overBudget).toBe(true);
    // The limit is a setting.
    expect(
      estimateSessionMinutes(
        { sessionType: "lift", items: block1Monday },
        {
          sessionWarmUpMinutes: 5,
          sessionGaitDrillMinutes: 3,
          sessionTransitionMinutes: 4,
          setWorkSeconds: 40,
          plyoWorkSeconds: 15,
          restMainSeconds: 150,
          restPairSeconds: 90,
          restAccessorySeconds: 60,
          restPlyoSeconds: 60,
          liftSessionMaxMinutes: 45,
        },
      )?.overBudget,
    ).toBe(true);
  });

  it("rides use their planned length; accessory blocks skip lift overheads", () => {
    expect(
      estimateSessionMinutes({
        sessionType: "peloton",
        items: [],
        minutesMax: 45,
      }),
    ).toEqual({ minutes: 45, overBudget: false });
    expect(
      estimateSessionMinutes({
        sessionType: "accessory",
        items: [item({ name: "Calf", sets: 3 })],
      }),
    ).toEqual({ minutes: 5, overBudget: false });
    expect(
      estimateSessionMinutes({ sessionType: "test", items: [] }),
    ).toBeNull();
  });
});

describe("superset rest logic", () => {
  const [a1, a2] = pair(
    "A",
    { name: "Squat", category: "main" },
    { name: "Pull-Up" },
  ) as [BudgetItem, BudgetItem];

  it("labels and groups pairs in order", () => {
    expect(supersetLabel(a2)).toBe("A2");
    expect(supersetLabel(item({ name: "x" }))).toBeNull();
    expect(
      groupItems([a2, item({ name: "solo" }), a1]).map((g) =>
        g.map((i) => i.name),
      ),
    ).toEqual([["Squat", "Pull-Up"], ["solo"]]);
  });

  it("no rest after the first item of a pair; 90 s after the second", () => {
    expect(restAfterSet({ item: a1, side: null, group: [a1, a2] })).toEqual({
      seconds: 0,
      next: "Next: A2 Pull-Up",
    });
    expect(restAfterSet({ item: a2, side: null, group: [a1, a2] })).toEqual({
      seconds: 90,
      next: "Then A1 Squat",
    });
  });

  it("per-leg: left goes straight to right, rest after the right", () => {
    const leg = item({
      name: "Step-Up",
      sideMode: "per_leg",
      supersetGroup: "A",
      supersetOrder: 1,
    });
    expect(restAfterSet({ item: leg, side: "left", group: [leg, a2] })).toEqual(
      {
        seconds: 0,
        next: "Right leg",
      },
    );
    expect(
      restAfterSet({ item: leg, side: "right", group: [leg, a2] }).seconds,
    ).toBe(0);
    const solo = { ...leg, supersetGroup: null };
    expect(
      restAfterSet({ item: solo, side: "right", group: [solo] }).seconds,
    ).toBe(60);
  });

  it("straight sets rest by category", () => {
    expect(
      restAfterSet({
        item: { ...a1, supersetGroup: null },
        side: null,
        group: [],
      }).seconds,
    ).toBe(150);
    expect(
      restAfterSet({
        item: item({ name: "Pogo", category: "plyo" }),
        side: null,
        group: [],
      }).seconds,
    ).toBe(60);
  });
});
