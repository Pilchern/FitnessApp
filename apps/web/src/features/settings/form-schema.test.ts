import { describe, expect, it } from "vitest";
import { settingsFormSchema } from "./form-schema";

const baseSettingsInput = {
  displayName: "Test User",
  timezone: "America/Chicago",
  unitsSystem: "imperial" as const,
  weekStartsOn: "1" as const,
  goalFatLoss: true,
  goalPreserveMuscle: true,
  goalImproveVo2: false,
};

describe("settingsFormSchema target weight/date", () => {
  it("treats blank targetWeightLb/targetDate as no target set", () => {
    const parsed = settingsFormSchema.parse({
      ...baseSettingsInput,
      targetWeightLb: "",
      targetDate: "",
    });

    expect(parsed.targetWeightLb).toBeNull();
    expect(parsed.targetDate).toBeNull();
  });

  it("parses a positive decimal target weight", () => {
    const parsed = settingsFormSchema.parse({
      ...baseSettingsInput,
      targetWeightLb: "180.5",
    });

    expect(parsed.targetWeightLb).toBe(180.5);
  });

  it("rejects a non-positive target weight", () => {
    expect(() =>
      settingsFormSchema.parse({
        ...baseSettingsInput,
        targetWeightLb: "0",
      }),
    ).toThrow();
  });

  it("accepts a valid ISO target date", () => {
    const parsed = settingsFormSchema.parse({
      ...baseSettingsInput,
      targetDate: "2027-03-01",
    });

    expect(parsed.targetDate).toBe("2027-03-01");
  });

  it("rejects a malformed target date", () => {
    expect(() =>
      settingsFormSchema.parse({
        ...baseSettingsInput,
        targetDate: "03/01/2027",
      }),
    ).toThrow();
  });
});
