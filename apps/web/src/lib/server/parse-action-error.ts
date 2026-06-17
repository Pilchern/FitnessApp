import { isRedirectError } from "next/dist/client/components/redirect-error";
import { ZodError } from "zod";

type ActionError = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

/**
 * Converts a caught error into a structured action error state.
 * Zod validation errors produce fieldErrors (keyed by field name) for inline display.
 * All other errors produce a top-level error string.
 *
 * NEXT_REDIRECT errors thrown by `redirect()` must be re-thrown so the redirect actually
 * fires — swallowing them turns every successful action into a silent no-op.
 */
export function parseActionError(error: unknown): ActionError {
  if (isRedirectError(error)) {
    throw error;
  }

  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const field = issue.path[0];
      if (field != null && typeof field === "string" && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      return { fieldErrors };
    }
    // ZodError with no named path (e.g. root-level refinements)
    return { error: error.issues[0]?.message ?? "Please review the form fields." };
  }

  if (error instanceof Error) {
    return { error: error.message };
  }

  return { error: "Something went wrong. Please try again." };
}
