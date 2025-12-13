import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase env vars for analytics errors");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const daysParam = searchParams.get("days");
    const days = daysParam ? Math.max(1, Number(daysParam)) : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: enrollments, error: enrError } = await supabaseAdmin
      .from("sms_sequence_enrollments")
      .select(
        "id, sequence_id, property_id, is_paused, current_step, next_run_at, created_at, completed_at"
      )
      .eq("is_paused", true)
      .order("created_at", { ascending: false })
      .limit(100);

    if (enrError) {
      console.error("[api/automation/analytics/errors] enrollments", {
        error: enrError.message,
        code: enrError.code,
      });
      return NextResponse.json(
        {
          error: "Failed to load enrollment errors",
          details: enrError.message,
          code: enrError.code,
        },
        { status: 500 }
      );
    }

    const { data: failedMsgs, error: msgError } = await supabaseAdmin
      .from("property_sms_messages")
      .select(
        "id, property_id, source, status, error_message, created_at"
      )
      .eq("status", "failed")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100);

    if (msgError) {
      console.error("[api/automation/analytics/errors] messages", {
        since,
        error: msgError.message,
        code: msgError.code,
      });
      return NextResponse.json(
        {
          error: "Failed to load message errors",
          details: msgError.message,
          code: msgError.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      enrollmentErrors: enrollments ?? [],
      messageErrors: failedMsgs ?? [],
      windowDays: days,
    });
  } catch (err: any) {
    console.error("[api/automation/analytics/errors] unexpected", {
      error: err?.message,
    });
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
