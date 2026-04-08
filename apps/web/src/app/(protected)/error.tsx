"use client";

import { RouteErrorState } from "@/components/shared/route-error-state";

type ProtectedErrorProps = {
  reset: () => void;
};

export default function ProtectedError({ reset }: ProtectedErrorProps) {
  return (
    <RouteErrorState
      title="Something went wrong"
      description="We couldn't load this page. Try again — if the issue continues, refreshing the whole app usually helps."
      reset={reset}
    />
  );
}
