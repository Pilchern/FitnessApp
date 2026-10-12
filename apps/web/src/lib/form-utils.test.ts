import { describe, expect, it } from "vitest";
import { optionalString } from "./form-utils";

describe("optionalString", () => {
  it("treats a field FormData did not find (null) as empty", () => {
    // formData.get("id") is null on a new lift session; rejecting it made
    // every new save fail silently.
    expect(optionalString.parse(null)).toBe("");
    expect(optionalString.parse(undefined)).toBe("");
  });

  it("trims text", () => {
    expect(optionalString.parse("  Mon Push ")).toBe("Mon Push");
  });
});
