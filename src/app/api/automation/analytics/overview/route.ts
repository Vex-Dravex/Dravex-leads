import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase env vars for analytics overview");
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

    const { data: messages, error: msgError } = await supabaseAdmin
      .from("property_sms_messages")
      .select("id, source, status, created_at")
      .gte("created_at", since);

    if (msgError) {
      console.error("[api/automation/analytics/overview] messages", {
        since,
        error: msgError.message,
        code: msgError.code,
      });
      return NextResponse.json(
        {
          error: "Failed to load messages",
          details: msgError.message,
          code: msgError.code,
        },
        { status: 500 }
      );
    }

    const totalSms = messages?.length ?? 0;
    const manualSms = (messages ?? []).filter((m) => m.source === "manual").length;
    const sequenceSms = (messages ?? []).filter((m) => m.source === "sequence").length;
    const failedSms = (messages ?? []).filter((m) => m.status === "failed").length;

    const { data: enrollments, error: enrError } = await supabaseAdmin
      .from("sms_sequence_enrollments")
      .select(
        "id, is_paused, completed_at"
      );

    if (enrError) {
      console.error("[api/automation/analytics/overview] enrollments", {
        error: enrError.message,
        code: enrError.code,
      });
      return NextResponse.json(
        {
          error: "Failed to load enrollments",
          details: enrError.message,
          code: enrError.code,
        },
        { status: 500 }
      );
    }

    const activeEnrollments = (enrollments ?? []).filter(
      (e) => !e.is_paused && !e.completed_at
    ).length;
    const pausedEnrollments = (enrollments ?? []).filter((e) => e.is_paused).length;
    const completedEnrollments = (enrollments ?? []).filter(
      (e) => !!e.completed_at
    ).length;
    const errorEnrollments = 0;

    return NextResponse.json({
      windowDays: days,
      totals: {
        sms: totalSms,
        manualSms,
        sequenceSms,
        failedSms,
      },
      enrollments: {
        active: activeEnrollments,
        paused: pausedEnrollments,
        completed: completedEnrollments,
        errored: errorEnrollments,
      },
    });
  } catch (err: any) {
    console.error("[api/automation/analytics/overview] unexpected", {
      error: err?.message,
    });
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
