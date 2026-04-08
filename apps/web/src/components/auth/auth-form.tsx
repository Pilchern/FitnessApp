"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { AuthActionState } from "@/lib/auth";
import { AuthSubmitButton } from "./auth-submit-button";

type AuthFormProps = {
  action: (
    state: AuthActionState,
    formData: FormData,
  ) => Promise<AuthActionState>;
  mode: "login" | "signup";
  redirectTo?: string;
  message?: string;
};

const initialState: AuthActionState = {};

export function AuthForm({
  action,
  mode,
  redirectTo,
  message,
}: AuthFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  const isSignup = mode === "signup";
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="redirectTo" value={redirectTo ?? "/dashboard"} />
      {isSignup ? <input type="hidden" name="timezone" value={timezone} /> : null}

      {message ? (
        <div className="rounded-2xl border border-pine/20 bg-pine/10 px-4 py-3 text-sm text-pine">
          {message}
        </div>
      ) : null}

      {state.error ? (
        <div className="rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-sm text-ember">
          {state.error}
        </div>
      ) : null}

      {isSignup ? (
        <label className="grid gap-2 text-sm font-medium text-ink">
          Display name
          <input
            name="displayName"
            type="text"
            autoComplete="name"
            placeholder="Ashley"
            className="h-12 rounded-2xl border border-ink/10 bg-white px-4 text-base text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20"
          />
        </label>
      ) : null}

      <label className="grid gap-2 text-sm font-medium text-ink">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="h-12 rounded-2xl border border-ink/10 bg-white px-4 text-base text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20"
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-ink">
        Password
        <input
          name="password"
          type="password"
          required
          autoComplete={isSignup ? "new-password" : "current-password"}
          placeholder={isSignup ? "Create a password" : "Enter your password"}
          className="h-12 rounded-2xl border border-ink/10 bg-white px-4 text-base text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20"
        />
      </label>

      {isSignup ? (
        <label className="grid gap-2 text-sm font-medium text-ink">
          Confirm password
          <input
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Repeat your password"
            className="h-12 rounded-2xl border border-ink/10 bg-white px-4 text-base text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20"
          />
        </label>
      ) : null}

      <AuthSubmitButton
        idleLabel={isSignup ? "Create account" : "Log in"}
        pendingLabel={isSignup ? "Creating account..." : "Logging in..."}
      />

      <p className="text-sm text-ink/70">
        {isSignup ? "Already have an account?" : "Need an account?"}{" "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="font-semibold text-pine underline-offset-4 hover:underline"
        >
          {isSignup ? "Log in" : "Sign up"}
        </Link>
      </p>
    </form>
  );
}
