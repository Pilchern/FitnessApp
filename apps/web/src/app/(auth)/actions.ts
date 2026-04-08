"use server";

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

function getErrorMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Please check the form values and try again.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
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
    return {
      error: getErrorMessage(error),
    };
  }
}

export async function signupAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  try {
    const rawTimezone = formData.get("timezone");
    const timezone =
      typeof rawTimezone === "string" && rawTimezone.trim()
        ? rawTimezone.trim()
        : undefined;

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
    return {
      error: getErrorMessage(error),
    };
  }
}

export async function logoutAction() {
  const supabase = await createSupabaseRequestClient();
  await supabase.auth.signOut();
  redirect("/login");
}
