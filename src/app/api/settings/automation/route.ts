import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase env vars for automation settings");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("user_smart_send_settings")
    .select(
      "user_id, timezone, quiet_hours_start, quiet_hours_end, enabled, created_at, updated_at"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed to load settings", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ settings: data ?? null });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, timezone, quietHoursStart, quietHoursEnd, enabled } = body || {};

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const payload = {
      user_id: userId,
      timezone: timezone ?? null,
      quiet_hours_start: quietHoursStart ?? null,
      quiet_hours_end: quietHoursEnd ?? null,
      enabled: enabled ?? true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("user_smart_send_settings")
      .upsert(payload, { onConflict: "user_id" })
      .select(
        "user_id, timezone, quiet_hours_start, quiet_hours_end, enabled, created_at, updated_at"
      )
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to save settings", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ settings: data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
