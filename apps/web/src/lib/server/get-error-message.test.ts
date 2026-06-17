import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { getErrorMessage } from "./get-error-message";

function makeRedirectError(url = "/dashboard") {
  const err = new Error(`NEXT_REDIRECT;replace;${url};307;`);
  (err as Error & { digest: string }).digest = `NEXT_REDIRECT;replace;${url};307;`;
  return err;
}

describe("getErrorMessage", () => {
  it("re-throws NEXT_REDIRECT errors", () => {
    const redirectError = makeRedirectError("/strength");
    expect(() => getErrorMessage(redirectError)).toThrow(redirectError);
  });

  it("returns first issue message for ZodError", () => {
    const zodError = new ZodError([
      { code: "custom", message: "Field required", path: ["name"] },
    ]);
    expect(getErrorMessage(zodError)).toBe("Field required");
  });

  it("returns error.message for plain Error", () => {
    expect(getErrorMessage(new Error("kaboom"))).toBe("kaboom");
  });

  it("returns generic message for unknown error shapes", () => {
    expect(getErrorMessage(42)).toBe("Something went wrong. Please try again.");
  });
});
