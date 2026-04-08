"use client";

import { RouteErrorState } from "@/components/shared/route-error-state";

type AuthErrorProps = {
  reset: () => void;
};

export default function AuthError({ reset }: AuthErrorProps) {
  return (
    <RouteErrorState
      title="Authentication flow failed to load"
      description="The auth screen hit an unexpected error. Try again. If the problem persists, verify your Supabase auth configuration."
      reset={reset}
    />
  );
}
