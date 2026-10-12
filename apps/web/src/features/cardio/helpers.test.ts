import { describe, expect, it } from "vitest";
import type { TrainingTemplate } from "@fitness-app/domain";
import { sumWeeklyZone2Target } from "./helpers";

function template(
  scheduledDayOfWeek: TrainingTemplate["scheduledDayOfWeek"],
  targetZone2Minutes?: number,
): TrainingTemplate {
  return {
    id: `t-${scheduledDayOfWeek}-${targetZone2Minutes}`,
    userId: "u",
    name: "Zone 2 bike",
    templateType: "cardio",
    isArchived: false,
    definition: { sessionKind: "zone2", targetZone2Minutes },
    scheduledDayOfWeek,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    deletedAt: null,
  };
}

describe("sumWeeklyZone2Target", () => {
  it("sums targets of scheduled templates only", () => {
    expect(
      sumWeeklyZone2Target([
        template(1, 45),
        template(3, 45),
        template(5, 60),
        template(null, 90),
      ]),
    ).toBe(150);
  });

  it("returns null when no scheduled template has a target", () => {
    expect(sumWeeklyZone2Target([template(1), template(null, 45)])).toBeNull();
  });
});
