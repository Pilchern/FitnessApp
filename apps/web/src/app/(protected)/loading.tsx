import { RouteLoadingState } from "@/components/shared/route-loading-state";

export default function ProtectedLoading() {
  return (
    <RouteLoadingState
      eyebrow="Protected app"
      title="Loading your dashboard"
      description="Fetching the latest user-scoped data, summaries, and module state."
    />
  );
}
