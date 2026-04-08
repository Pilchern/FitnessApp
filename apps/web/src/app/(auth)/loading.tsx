import { RouteLoadingState } from "@/components/shared/route-loading-state";

export default function AuthLoading() {
  return (
    <RouteLoadingState
      eyebrow="Secure access"
      title="Loading account access"
      description="Preparing the authentication flow and protected session state."
    />
  );
}
