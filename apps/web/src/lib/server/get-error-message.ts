import { isRedirectError } from "next/dist/client/components/redirect-error";
import { ZodError } from "zod";

export function getErrorMessage(error: unknown): string {
  // redirect() throws NEXT_REDIRECT — must propagate, not be returned as an error message
  if (isRedirectError(error)) {
    throw error;
  }

  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Please review the form fields.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}
