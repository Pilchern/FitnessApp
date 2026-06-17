"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { AuthActionState } from "@/lib/auth";
import { mapAuthErrorMessage, sanitizeRedirectTo } from "@/lib/auth";
import { ensureProfileForUser } from "@/lib/server/profile-bootstrap";
import { createSupabaseRequestClient } from "@/lib/server/supabase";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  redirectTo: z.string().optional(),
});

const signupSchema = loginSchema
  .extend({
    displayName: z.string().trim().max(80).optional(),
    confirmPassword: z.string().min(8, "Confirm your password."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords must match.",
    path: ["confirmPassword"],
  });

// IANA timezone validator — invalid hints fall back to UTC rather than blocking signup.
function isValidTimezone(value: string): boolean {
  try {
    const supported = (
      Intl as typeof Intl & {
        supportedValuesOf?: (key: string) => string[];
      }
    ).supportedValuesOf?.("timeZone");
    if (supported && supported.length > 0) {
      return supported.includes(value);
    }
  } catch {
    // fall through to constructor probe
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function buildAuthError(error: unknown): AuthActionState {
  if (error instanceof z.ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      return { fieldErrors };
    }
    return {
      error: error.issues[0]?.message ?? "Please check the form values and try again.",
    };
  }

  if (error instanceof Error) {
    return { error: error.message };
  }

  return { error: "Something went wrong. Please try again." };
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  try {
    const parsed = loginSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: formData.get("redirectTo"),
    });

    const supabase = await createSupabaseRequestClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.email,
      password: parsed.password,
    });

    if (error) {
      return {
        error: mapAuthErrorMessage(error.message),
      };
    }

    if (data.user) {
      await ensureProfileForUser(data.user);
    }

    redirect(sanitizeRedirectTo(parsed.redirectTo));
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    return buildAuthError(error);
  }
}

export async function signupAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  try {
    const rawTimezone = formData.get("timezone");
    const candidateTimezone =
      typeof rawTimezone === "string" && rawTimezone.trim()
        ? rawTimezone.trim()
        : null;
    const timezone =
      candidateTimezone && isValidTimezone(candidateTimezone)
        ? candidateTimezone
        : "UTC";

    const parsed = signupSchema.parse({
      displayName: formData.get("displayName"),
      email: formData.get("email"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
      redirectTo: formData.get("redirectTo"),
    });

    const supabase = await createSupabaseRequestClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.email,
      password: parsed.password,
      options: {
        data: {
          display_name: parsed.displayName?.trim() || undefined,
        },
      },
    });

    if (error) {
      return {
        error: mapAuthErrorMessage(error.message),
      };
    }

    if (data.user && data.session) {
      await ensureProfileForUser(data.user, timezone);
      redirect(sanitizeRedirectTo(parsed.redirectTo));
    }

    redirect(
      "/login?message=Account%20created.%20If%20email%20confirmation%20is%20enabled,%20check%20your%20inbox%20before%20logging%20in.",
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    return buildAuthError(error);
  }
}

export async function logoutAction() {
  const supabase = await createSupabaseRequestClient();
  await supabase.auth.signOut();
  redirect("/login");
}
