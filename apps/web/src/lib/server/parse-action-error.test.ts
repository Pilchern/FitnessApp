import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { parseActionError } from "./parse-action-error";

// Mirrors the shape Next's redirect() throws — see next/dist/client/components/redirect-error.
function makeRedirectError(url = "/dashboard") {
  const err = new Error(`NEXT_REDIRECT;replace;${url};307;`);
  // The discriminator isRedirectError checks for is the "NEXT_REDIRECT" digest prefix
  // plus a `digest` string on the error.
  (err as Error & { digest: string }).digest = `NEXT_REDIRECT;replace;${url};307;`;
  return err;
}

describe("parseActionError", () => {
  it("re-throws NEXT_REDIRECT errors so the redirect can complete", () => {
    const redirectError = makeRedirectError("/cardio");
    expect(() => parseActionError(redirectError)).toThrow(redirectError);
  });

  it("returns fieldErrors for ZodError with named paths", () => {
    const zodError = new ZodError([
      {
        code: "custom",
        message: "Email is invalid",
        path: ["email"],
      },
    ]);
    expect(parseActionError(zodError)).toEqual({
      fieldErrors: { email: "Email is invalid" },
    });
  });

  it("returns top-level error for plain Error", () => {
    expect(parseActionError(new Error("boom"))).toEqual({ error: "boom" });
  });

  it("returns generic message for unknown error shapes", () => {
    expect(parseActionError("nope")).toEqual({
      error: "Something went wrong. Please try again.",
    });
  });
});
