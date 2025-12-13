import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase env vars for analytics error reset");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { enrollmentId } = body || {};

    if (!enrollmentId) {
      return NextResponse.json(
        { error: "enrollmentId is required" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("sms_sequence_enrollments")
      .update({
        is_paused: false,
        next_run_at: new Date().toISOString(),
      })
      .eq("id", enrollmentId);

    if (error) {
      console.error("[api/automation/analytics/errors/reset] update", {
        enrollmentId,
        error: error.message,
        code: error.code,
      });
      return NextResponse.json(
        {
          error: error.message || "Failed to reset error",
          details: error.message,
          code: error.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[api/automation/analytics/errors/reset] unexpected", {
      error: err?.message,
    });
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
