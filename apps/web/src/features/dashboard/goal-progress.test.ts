import { describe, expect, it } from "vitest";
import { computeGoalProgress } from "./goal-progress";

const NOW = new Date("2026-06-21T12:00:00Z");

function daysAgo(days: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

describe("computeGoalProgress", () => {
  it("returns empty array when profile is null", () => {
    expect(computeGoalProgress(null, [], [], [], NOW)).toEqual([]);
  });

  it("returns empty array when no goals are set", () => {
    const profile = { goalFatLoss: false, goalPreserveMuscle: false, goalImproveVo2: false };
    expect(computeGoalProgress(profile, [], [], [], NOW)).toEqual([]);
  });

  describe("fat loss goal", () => {
    const profile = { goalFatLoss: true, goalPreserveMuscle: false, goalImproveVo2: false };

    it("returns insufficient_data when fewer than 2 weight entries span 28 days", () => {
      const body = [{ measuredOn: daysAgo(5), weightLb: 190 }];
      const [result] = computeGoalProgress(profile, body, [], [], NOW);
      expect(result.trend).toBe("insufficient_data");
    });

    it("returns improving when weight dropped >= 0.5lb in 4 weeks", () => {
      const body = [
        { measuredOn: daysAgo(1), weightLb: 188 },
        { measuredOn: daysAgo(30), weightLb: 190 },
      ];
      const [result] = computeGoalProgress(profile, body, [], [], NOW);
      expect(result.trend).toBe("improving");
      expect(result.trendDetail).toContain("down 2.0lb");
    });

    it("returns declining when weight increased >= 1lb in 4 weeks", () => {
      const body = [
        { measuredOn: daysAgo(1), weightLb: 192 },
        { measuredOn: daysAgo(30), weightLb: 190 },
      ];
      const [result] = computeGoalProgress(profile, body, [], [], NOW);
      expect(result.trend).toBe("declining");
    });

    it("returns maintaining when weight change is within -0.5 to +1lb", () => {
      const body = [
        { measuredOn: daysAgo(1), weightLb: 190.3 },
        { measuredOn: daysAgo(30), weightLb: 190 },
      ];
      const [result] = computeGoalProgress(profile, body, [], [], NOW);
      expect(result.trend).toBe("maintaining");
    });

    it("ignores entries with null weightLb", () => {
      const body = [
        { measuredOn: daysAgo(1), weightLb: null },
        { measuredOn: daysAgo(30), weightLb: null },
      ];
      const [result] = computeGoalProgress(profile, body, [], [], NOW);
      expect(result.trend).toBe("insufficient_data");
    });
  });

  describe("preserve muscle goal", () => {
    const profile = { goalFatLoss: false, goalPreserveMuscle: true, goalImproveVo2: false };

    function session(date: string, weightLb: number, reps: number) {
      return { sessionDate: date, sets: [{ weight: weightLb, reps }] };
    }

    it("returns insufficient_data when no sessions in one of the months", () => {
      const sessions = [session(daysAgo(5), 100, 5)];
      const [result] = computeGoalProgress(profile, [], sessions, [], NOW);
      expect(result.trend).toBe("insufficient_data");
    });

    it("returns improving when this month volume is 5%+ more than last month", () => {
      const sessions = [
        session(daysAgo(5), 200, 5),   // this month: 1000
        session(daysAgo(35), 100, 5),  // last month: 500
      ];
      const [result] = computeGoalProgress(profile, [], sessions, [], NOW);
      expect(result.trend).toBe("improving");
    });

    it("returns declining when this month volume dropped 10%+ vs last month", () => {
      const sessions = [
        session(daysAgo(5), 100, 5),   // this month: 500
        session(daysAgo(35), 200, 10), // last month: 2000
      ];
      const [result] = computeGoalProgress(profile, [], sessions, [], NOW);
      expect(result.trend).toBe("declining");
    });

    it("returns maintaining for small changes between -10% and +5%", () => {
      const sessions = [
        session(daysAgo(5), 100, 5),   // this month: 500
        session(daysAgo(35), 103, 5),  // last month: 515 (~3% drop)
      ];
      const [result] = computeGoalProgress(profile, [], sessions, [], NOW);
      expect(result.trend).toBe("maintaining");
    });
  });

  describe("improve VO2 goal", () => {
    const profile = { goalFatLoss: false, goalPreserveMuscle: false, goalImproveVo2: true };

    function cardioSession(date: string, kind: string, zone2Minutes: number | null, durationMinutes: number | null) {
      return { sessionDate: date, sessionKind: kind, zone2Minutes, durationMinutes };
    }

    it("returns insufficient_data when no zone2/vo2 sessions at all", () => {
      const [result] = computeGoalProgress(profile, [], [], [], NOW);
      expect(result.trend).toBe("insufficient_data");
    });

    it("returns improving when this 4 weeks average is 20+ min/week more than prior", () => {
      const cardio = [
        cardioSession(daysAgo(5), "zone2", 120, null),   // recent: 120 min
        cardioSession(daysAgo(35), "zone2", 0, null),    // prior: 0 min
      ];
      const [result] = computeGoalProgress(profile, [], [], cardio, NOW);
      expect(result.trend).toBe("improving");
    });

    it("returns declining when this 4 weeks is 20+ min/week less than prior", () => {
      const cardio = [
        cardioSession(daysAgo(35), "zone2", 200, null),  // prior: 200 min
        cardioSession(daysAgo(5), "zone2", 0, null),     // recent: 0 min
      ];
      const [result] = computeGoalProgress(profile, [], [], cardio, NOW);
      expect(result.trend).toBe("declining");
    });

    it("falls back to durationMinutes when zone2Minutes is null", () => {
      const cardio = [cardioSession(daysAgo(5), "zone2", null, 90)];
      const [result] = computeGoalProgress(profile, [], [], cardio, NOW);
      expect(result.trend).not.toBe("insufficient_data");
    });

    it("ignores non-zone2/vo2 sessions", () => {
      const cardio = [cardioSession(daysAgo(5), "ride", null, 90)];
      const [result] = computeGoalProgress(profile, [], [], cardio, NOW);
      expect(result.trend).toBe("insufficient_data");
    });
  });

  it("returns progress entries for all active goals", () => {
    const profile = { goalFatLoss: true, goalPreserveMuscle: true, goalImproveVo2: true };
    const results = computeGoalProgress(profile, [], [], [], NOW);
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.label)).toEqual(["Fat loss", "Preserve muscle", "Improve VO2"]);
  });
});
