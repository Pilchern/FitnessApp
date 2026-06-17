import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createStravaAdapter, createStravaSyncOrchestrator } from "@/lib/server/integrations";
import { createSupabaseRequestClient } from "@/lib/server/supabase";

const OAUTH_STATE_COOKIE = "strava_oauth_state";
const OAUTH_USER_COOKIE = "strava_oauth_user_id";

async function requireRouteUser() {
  const supabase = await createSupabaseRequestClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

function redirectWithMessage(request: NextRequest, search: string) {
  return NextResponse.redirect(new URL(`/integrations?${search}`, request.url));
}

export async function GET(request: NextRequest) {
  const user = await requireRouteUser();

  if (!user) {
    return redirectWithMessage(
      request,
      "error=Please%20log%20in%20before%20connecting%20Strava.",
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const providerError =
    searchParams.get("error_description") ?? searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  const expectedUserId = cookieStore.get(OAUTH_USER_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);
  cookieStore.delete(OAUTH_USER_COOKIE);

  if (providerError) {
    return redirectWithMessage(
      request,
      `error=${encodeURIComponent(providerError)}`,
    );
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithMessage(
      request,
      "error=The%20Strava%20OAuth%20callback%20could%20not%20be%20validated.",
    );
  }

  if (!expectedUserId || expectedUserId !== user.id) {
    return redirectWithMessage(
      request,
      "error=The%20Strava%20OAuth%20callback%20could%20not%20be%20validated.",
    );
  }

  try {
    const adapter = createStravaAdapter();
    const exchange = await adapter.exchangeCode({ code });
    const orchestrator = createStravaSyncOrchestrator();

    await orchestrator.finalizeOAuthConnection({
      userId: user.id,
      provider: "strava",
      accountLabel: exchange.accountLabel,
      providerUserId: exchange.providerUserId,
      scopes: exchange.tokenSet.scopes,
      capabilities: adapter.capabilities,
      metadata: exchange.metadata,
      tokenSet: exchange.tokenSet,
    });

    // Kick off initial sync of recent rides
    await orchestrator.syncRides({
      userId: user.id,
      provider: "strava",
      triggerType: "manual",
    });

    return redirectWithMessage(request, "status=strava_connected");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Strava connection failed.";
    return redirectWithMessage(
      request,
      `error=${encodeURIComponent(message)}`,
    );
  }
}
