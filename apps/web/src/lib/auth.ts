import { z } from "zod";

export const authActionStateSchema = z.object({
  error: z.string().optional(),
});

export type AuthActionState = z.infer<typeof authActionStateSchema>;

const safeRedirectPattern = /^\/(?!\/)/;

export function sanitizeRedirectTo(value: string | null | undefined) {
  if (!value || !safeRedirectPattern.test(value)) {
    return "/dashboard";
  }

  return value;
}

export function mapAuthErrorMessage(message: string) {
  if (message.includes("Invalid login credentials")) {
    return "Invalid email or password.";
  }

  if (message.includes("Email not confirmed")) {
    return "Check your inbox and confirm your email before logging in.";
  }

  if (message.includes("User already registered")) {
    return "An account with this email already exists. Try logging in instead.";
  }

  if (message.includes("Password should be at least")) {
    return "Password must be at least 8 characters.";
  }

  return message;
}
