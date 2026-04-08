import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRequestClient } from "@/lib/server/supabase";
import { createPelotonSyncOrchestrator } from "@/lib/server/integrations";

async function requireRouteUser() {
  const supabase = await createSupabaseRequestClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function POST(request: NextRequest) {
  const user = await requireRouteUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let username: string;
  let password: string;

  try {
    const body = await request.json();
    username = String(body.username ?? "").trim();
    password = String(body.password ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required." },
      { status: 400 },
    );
  }

  try {
    const orchestrator = createPelotonSyncOrchestrator();
    await orchestrator.connect({
      userId: user.id,
      provider: "peloton",
      username,
      password,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Peloton connection failed.";

    const isAuthError =
      message.includes("401") ||
      message.toLowerCase().includes("unauthorized") ||
      message.toLowerCase().includes("invalid") ||
      message.toLowerCase().includes("credentials");

    return NextResponse.json(
      {
        ok: false,
        error: isAuthError
          ? "Incorrect Peloton username or password."
          : message,
      },
      { status: 400 },
    );
  }
}
