import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createWithingsAdapter, getWithingsIntegrationConfig } from "@/lib/server/integrations";
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

export async function GET(request: NextRequest) {
  const user = await requireRouteUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!getWithingsIntegrationConfig()) {
    return NextResponse.redirect(
      new URL(
        "/integrations?error=Withings%20env%20vars%20are%20not%20configured.",
        request.url,
      ),
    );
  }

  const state = randomUUID();
  const adapter = createWithingsAdapter();
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
