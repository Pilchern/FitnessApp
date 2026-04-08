import { describe, expect, it } from "vitest";
import { buildFlashMessage, getIntegrationStatusGuidance } from "./helpers";

describe("buildFlashMessage", () => {
  it("prioritizes explicit errors", () => {
    expect(buildFlashMessage("connected", "Something broke")).toEqual({
      tone: "error",
      text: "Something broke",
    });
  });

  it("maps known integration success states", () => {
    expect(buildFlashMessage("connected")).toEqual({
      tone: "success",
      text: "Withings connected. Your measurements are syncing now.",
    });
  });
});

describe("getIntegrationStatusGuidance", () => {
  it("returns guidance for missing connections", () => {
    expect(getIntegrationStatusGuidance(null)).toMatchObject({
      tone: "default",
    });
  });

  it("returns alert guidance for error states", () => {
    expect(
      getIntegrationStatusGuidance({
        status: "error",
      } as never),
    ).toMatchObject({
      tone: "alert",
    });
  });
});
