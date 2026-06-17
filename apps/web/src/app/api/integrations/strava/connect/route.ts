import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createStravaAdapter, getStravaIntegrationConfig } from "@/lib/server/integrations";
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

export async function GET(request: NextRequest) {
  const user = await requireRouteUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!getStravaIntegrationConfig()) {
    return NextResponse.redirect(
      new URL(
        "/integrations?error=Strava%20env%20vars%20are%20not%20configured.",
        request.url,
      ),
    );
  }

  const state = randomUUID();
  const adapter = createStravaAdapter();
  const cookieStore = await cookies();
  const secure = request.nextUrl.protocol === "https:";

  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 60 * 10,
    path: "/",
  });
  cookieStore.set(OAUTH_USER_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 60 * 10,
    path: "/",
  });

  return NextResponse.redirect(adapter.buildAuthorizationUrl({ state }));
}
