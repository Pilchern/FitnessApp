import { describe, expect, it } from "vitest";
import { deleteAccountFormSchema } from "./form-schema";

describe("deleteAccountFormSchema", () => {
  it("accepts the exact confirmation phrase", () => {
    const parsed = deleteAccountFormSchema.parse({ confirmation: "DELETE" });
    expect(parsed.confirmation).toBe("DELETE");
  });

  it("rejects a lowercase confirmation", () => {
    expect(() =>
      deleteAccountFormSchema.parse({ confirmation: "delete" }),
    ).toThrow();
  });

  it("rejects an empty confirmation", () => {
    expect(() => deleteAccountFormSchema.parse({ confirmation: "" })).toThrow();
  });

  it("rejects a missing confirmation field", () => {
    expect(() => deleteAccountFormSchema.parse({})).toThrow();
  });

  it("rejects a similar but incorrect phrase", () => {
    expect(() =>
      deleteAccountFormSchema.parse({ confirmation: "DELETE ME" }),
    ).toThrow();
  });
});
