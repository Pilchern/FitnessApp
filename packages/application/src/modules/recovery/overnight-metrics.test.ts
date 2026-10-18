import { describe, expect, it } from "vitest";
import type { RecoveryCheckin } from "@fitness-app/domain";
import {
  OvernightMetricsService,
  overnightDateOf,
  overnightWindowFor,
  summarizeOvernight,
  type OvernightSample,
  type OvernightSampleRepository,
} from "./overnight-metrics";
import type {
  RecoveryCheckinRepository,
  UpdateRecoveryCheckinInput,
} from "./recovery-checkin";

const hourly = (
  metric: OvernightSample["metric"],
  points: [string, number][],
): OvernightSample[] =>
  points.map(([sampleLocal, value]) => ({
    metric,
    sampleLocal,
    bucketMinutes: 60,
    value,
  }));

/** Heart rate for a 00:15 bedtime: awake and high at 23:00, asleep after. */
const lateNightHeartRate = hourly("heart_rate", [
  ["2026-10-17T22:00:00", 100],
  ["2026-10-17T23:00:00", 96],
  ["2026-10-18T00:00:00", 70],
  ["2026-10-18T01:00:00", 58],
  ["2026-10-18T02:00:00", 56],
  ["2026-10-18T03:00:00", 55],
  ["2026-10-18T04:00:00", 56],
  ["2026-10-18T05:00:00", 57],
  ["2026-10-18T06:00:00", 58],
  ["2026-10-18T07:00:00", 59],
  ["2026-10-18T08:00:00", 66],
  ["2026-10-18T09:00:00", 90],
]);

const lateNight = {
  bedtimeLocal: "00:15",
  wakeTimeLocal: "08:39",
  sleepDurationMinutes: 459,
};

describe("overnightWindowFor", () => {
  it("runs from bedtime to wake, placing an evening bedtime the day before", () => {
    expect(
      overnightWindowFor("2026-10-16", {
        bedtimeLocal: "21:23",
        wakeTimeLocal: "06:29",
        sleepDurationMinutes: 523,
      }),
    ).toEqual({
      kind: "sleep",
      start: "2026-10-15T21:23:00",
      end: "2026-10-16T06:29:00",
    });
    expect(overnightWindowFor("2026-10-18", lateNight)).toEqual({
      kind: "sleep",
      start: "2026-10-18T00:15:00",
      end: "2026-10-18T08:39:00",
    });
  });

  it("falls back to 23:00-06:00 without sleep, or with an implausible span", () => {
    const fixed = {
      kind: "fixed",
      start: "2026-10-17T23:00:00",
      end: "2026-10-18T06:00:00",
    };
    expect(overnightWindowFor("2026-10-18", null)).toEqual(fixed);
    expect(
      overnightWindowFor("2026-10-18", {
        ...lateNight,
        sleepDurationMinutes: null,
      }),
    ).toEqual(fixed);
    // A nap's times (13:00 to 13:40) are not a night.
    expect(
      overnightWindowFor("2026-10-18", {
        bedtimeLocal: "13:00",
        wakeTimeLocal: "13:40",
        sleepDurationMinutes: 40,
      }),
    ).toEqual(fixed);
  });
});

describe("summarizeOvernight", () => {
  it("weights hourly averages by the minutes inside the sleep window", () => {
    const sleep = summarizeOvernight(
      lateNightHeartRate,
      overnightWindowFor("2026-10-18", lateNight),
    );
    // 00:00 counts 45 min, 08:00 counts 39 min; 23:00 and 09:00 not at all.
    expect(sleep.sleepAvgHeartRate).toBe(59);

    const fixed = summarizeOvernight(
      lateNightHeartRate,
      overnightWindowFor("2026-10-18", null),
    );
    // The old fixed window: 23:00-05:59, the awake hour included.
    expect(fixed.sleepAvgHeartRate).toBe(64);
  });

  it("prefers single readings inside the window over hourly averages", () => {
    const window = overnightWindowFor("2026-10-18", lateNight);
    const samples: OvernightSample[] = [
      ...hourly("hrv", [
        ["2026-10-18T02:00:00", 40],
        ["2026-10-18T03:00:00", 50],
      ]),
      {
        metric: "hrv",
        sampleLocal: "2026-10-17T23:40:12",
        bucketMinutes: 0,
        value: 20,
      },
      {
        metric: "hrv",
        sampleLocal: "2026-10-18T02:31:05",
        bucketMinutes: 0,
        value: 62,
      },
      {
        metric: "hrv",
        sampleLocal: "2026-10-18T05:12:40",
        bucketMinutes: 0,
        value: 70,
      },
    ];
    expect(summarizeOvernight(samples, window).sleepHrvAvg).toBe(66);
  });

  it("needs 30 min of hourly coverage before reporting a metric", () => {
    const window = overnightWindowFor("2026-10-18", lateNight);
    const edge = hourly("respiratory_rate", [["2026-10-18T08:00:00", 16]]);
    expect(summarizeOvernight(edge, window).sleepRespiratoryRate).toBe(16);
    const sliver = hourly("respiratory_rate", [["2026-10-17T23:00:00", 16]]);
    expect(
      summarizeOvernight(sliver, {
        ...window,
        start: "2026-10-17T23:40:00",
      }).sleepRespiratoryRate,
    ).toBeNull();
  });
});

describe("overnightDateOf", () => {
  it("rolls evening samples onto the next morning", () => {
    expect(overnightDateOf("2026-10-17T21:00:00")).toBe("2026-10-18");
    expect(overnightDateOf("2026-10-18T02:00:00")).toBe("2026-10-18");
  });
});

class MemorySamples implements OvernightSampleRepository {
  rows: OvernightSample[] = [];
  async upsertMany(_userId: string, samples: OvernightSample[]) {
    for (const s of samples) {
      this.rows = this.rows.filter(
        (r) =>
          !(
            r.metric === s.metric &&
            r.sampleLocal === s.sampleLocal &&
            r.bucketMinutes === s.bucketMinutes
          ),
      );
      this.rows.push(s);
    }
  }
  async listBetween(_userId: string, from: string, to: string) {
    return this.rows.filter((r) => r.sampleLocal >= from && r.sampleLocal < to);
  }
}

function memoryCheckins(rows: Partial<RecoveryCheckin>[]) {
  const store = new Map(
    rows.map((r) => [r.checkinDate!, { id: `id-${r.checkinDate}`, ...r }]),
  );
  const updates: UpdateRecoveryCheckinInput[] = [];
  const repo = {
    findByDate: async (_userId: string, date: string) =>
      (store.get(date) as RecoveryCheckin | undefined) ?? null,
    update: async (input: UpdateRecoveryCheckinInput) => {
      updates.push(input);
      const row = [...store.values()].find((r) => r.id === input.id)!;
      Object.assign(
        row,
        Object.fromEntries(
          Object.entries(input).filter(([, v]) => v !== undefined),
        ),
      );
      return row as RecoveryCheckin;
    },
  } as unknown as RecoveryCheckinRepository;
  return { repo, store, updates };
}

describe("OvernightMetricsService", () => {
  const USER = "11111111-1111-4111-8111-111111111111";

  it("lands the same night whichever automation arrives first", async () => {
    // Vitals first: no sleep times yet, so the fixed window is used.
    const samples = new MemorySamples();
    const checkins = memoryCheckins([{ checkinDate: "2026-10-18" }]);
    const service = new OvernightMetricsService(samples, checkins.repo);
    await service.sync(USER, lateNightHeartRate, []);
    expect(checkins.store.get("2026-10-18")).toMatchObject({
      sleepAvgHeartRate: 64,
      overnightWindow: "fixed",
    });

    // Then sleep syncs bedtime and wake; the night is redone over sleep.
    Object.assign(checkins.store.get("2026-10-18")!, lateNight);
    await service.sync(USER, [], ["2026-10-18"]);
    expect(checkins.store.get("2026-10-18")).toMatchObject({
      sleepAvgHeartRate: 59,
      overnightWindow: "sleep",
    });

    // Sleep first, vitals second: same answer.
    const other = memoryCheckins([{ checkinDate: "2026-10-18", ...lateNight }]);
    await new OvernightMetricsService(new MemorySamples(), other.repo).sync(
      USER,
      lateNightHeartRate,
      [],
    );
    expect(other.store.get("2026-10-18")).toMatchObject({
      sleepAvgHeartRate: 59,
      overnightWindow: "sleep",
    });
  });

  it("clears a vital with no coverage while asleep, keeps it on the fixed window", async () => {
    const samples = new MemorySamples();
    const checkins = memoryCheckins([
      { checkinDate: "2026-10-18", ...lateNight, sleepHrvAvg: 48 },
    ]);
    await new OvernightMetricsService(samples, checkins.repo).sync(
      USER,
      lateNightHeartRate,
      [],
    );
    expect(checkins.updates[0]).toMatchObject({ sleepHrvAvg: null });

    const fixed = memoryCheckins([
      { checkinDate: "2026-10-18", sleepHrvAvg: 48 },
    ]);
    await new OvernightMetricsService(new MemorySamples(), fixed.repo).sync(
      USER,
      lateNightHeartRate,
      [],
    );
    expect(fixed.updates[0]?.sleepHrvAvg).toBeUndefined();
  });

  it("skips nights with no check-in and nights with no samples", async () => {
    const checkins = memoryCheckins([{ checkinDate: "2026-10-17" }]);
    const updated = await new OvernightMetricsService(
      new MemorySamples(),
      checkins.repo,
    ).sync(USER, lateNightHeartRate, ["2026-10-17"]);
    expect(updated).toBe(0);
    expect(checkins.updates).toEqual([]);
  });
});
