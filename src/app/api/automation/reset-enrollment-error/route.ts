import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase env vars for reset enrollment error route");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type ResetPayload = {
  enrollmentId?: string;
};

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as ResetPayload;
    const enrollmentId = body.enrollmentId;

    if (!enrollmentId) {
      return NextResponse.json(
        { error: "enrollmentId is required" },
        { status: 400 }
      );
    }

    const { data: enrollment, error: fetchError } = await supabaseAdmin
      .from("sms_sequence_enrollments")
      .select("id, last_error, is_paused")
      .eq("id", enrollmentId)
      .maybeSingle();

    if (fetchError) {
      console.error("[api/automation/reset-enrollment-error] fetch", {
        enrollmentId,
        error: fetchError.message,
        code: fetchError.code,
      });
      return NextResponse.json(
        {
          error: "Failed to load enrollment",
          details: fetchError.message,
          code: fetchError.code,
        },
        { status: 500 }
      );
    }

    if (!enrollment) {
      return NextResponse.json(
        { error: "Enrollment not found", id: enrollmentId },
        { status: 404 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("sms_sequence_enrollments")
      .update({
        last_error: null,
        last_error_at: null,
        is_paused: false,
        next_run_at: new Date().toISOString(),
      })
      .eq("id", enrollmentId);

    if (updateError) {
      console.error("[api/automation/reset-enrollment-error] update", {
        enrollmentId,
        error: updateError.message,
        code: updateError.code,
      });
      return NextResponse.json(
        {
          error: "Failed to reset enrollment",
          details: updateError.message,
          code: updateError.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[api/automation/reset-enrollment-error] unexpected", {
      error: err?.message,
    });
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
