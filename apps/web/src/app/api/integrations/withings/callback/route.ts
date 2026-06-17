import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createWithingsAdapter, createWithingsSyncOrchestrator } from "@/lib/server/integrations";
import { createSupabaseRequestClient } from "@/lib/server/supabase";

const OAUTH_STATE_COOKIE = "withings_oauth_state";
const OAUTH_USER_COOKIE = "withings_oauth_user_id";

async function requireRouteUser() {
  const supabase = await createSupabaseRequestClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return user;
}

function redirectWithMessage(request: NextRequest, search: string) {
  return NextResponse.redirect(new URL(`/integrations?${search}`, request.url));
}

export async function GET(request: NextRequest) {
  const user = await requireRouteUser();

  if (!user) {
    return redirectWithMessage(request, "error=Please%20log%20in%20before%20connecting%20Withings.");
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
      "error=The%20Withings%20OAuth%20callback%20could%20not%20be%20validated.",
    );
  }

  if (!expectedUserId || expectedUserId !== user.id) {
    return redirectWithMessage(
      request,
      "error=The%20Withings%20OAuth%20callback%20could%20not%20be%20validated.",
    );
  }

  try {
    const adapter = createWithingsAdapter();
    const exchange = await adapter.exchangeCode({ code });
    const orchestrator = createWithingsSyncOrchestrator();

    await orchestrator.finalizeOAuthConnection({
      userId: user.id,
      provider: "withings",
      accountLabel: exchange.accountLabel,
      providerUserId: exchange.providerUserId,
      scopes: exchange.tokenSet.scopes,
      capabilities: adapter.capabilities,
      metadata: exchange.metadata,
      tokenSet: exchange.tokenSet,
    });

    await orchestrator.syncBodyMetrics({
      userId: user.id,
      provider: "withings",
      triggerType: "manual",
    });

    return redirectWithMessage(request, "status=connected");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Withings connection failed.";

    return redirectWithMessage(
      request,
      `error=${encodeURIComponent(message)}`,
    );
  }
}
