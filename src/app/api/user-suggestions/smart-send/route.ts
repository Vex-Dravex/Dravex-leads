import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase env vars for smart send route");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("user_smart_send_settings")
    .select("user_id, enabled, quiet_hours_start, quiet_hours_end, timezone")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load settings" },
      { status: 500 }
    );
  }

  return NextResponse.json({ settings: data });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, enabled, quiet_hours_start, quiet_hours_end, timezone } =
      body || {};

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("user_smart_send_settings")
      .upsert({
        user_id: userId,
        enabled: typeof enabled === "boolean" ? enabled : true,
        quiet_hours_start: quiet_hours_start ?? null,
        quiet_hours_end: quiet_hours_end ?? null,
        timezone: timezone ?? "UTC",
      });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to update settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

