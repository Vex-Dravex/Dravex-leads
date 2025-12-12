import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type SequenceStep = {
  step_number: number;
  delay_minutes: number;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase env vars for sequence-enrollment route"
  );
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { propertyId, sequenceId, userId } = body || {};

    if (!propertyId || !sequenceId || !userId) {
      return NextResponse.json(
        { error: "propertyId, sequenceId, and userId are required" },
        { status: 400 }
      );
    }

    const { data: stepData, error: stepError } = await supabaseAdmin
      .from("sms_sequence_steps")
      .select("step_number, delay_minutes")
      .eq("sequence_id", sequenceId)
      .order("step_number", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (stepError || !stepData) {
      return NextResponse.json(
        { error: "Could not load first step for sequence" },
        { status: 400 }
      );
    }

    const firstStep: SequenceStep = stepData;
    const delayMinutes = firstStep.delay_minutes ?? 0;
    const nextRunAt = new Date(
      Date.now() + delayMinutes * 60 * 1000
    ).toISOString();

    const { data: enrollment, error: insertError } = await supabaseAdmin
      .from("sms_sequence_enrollments")
      .insert({
        sequence_id: sequenceId,
        property_id: propertyId,
        user_id: userId,
        current_step: firstStep.step_number,
        next_run_at: nextRunAt,
        is_paused: false,
      })
      .select("*")
      .single();

    if (insertError || !enrollment) {
      return NextResponse.json(
        { error: insertError?.message ?? "Failed to create enrollment" },
        { status: 400 }
      );
    }

    return NextResponse.json({ enrollment });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { enrollmentId, action } = body || {};

    if (!enrollmentId || !action) {
      return NextResponse.json(
        { error: "enrollmentId and action are required" },
        { status: 400 }
      );
    }

    const { data: enrollment, error: fetchError } = await supabaseAdmin
      .from("sms_sequence_enrollments")
      .select("*")
      .eq("id", enrollmentId)
      .maybeSingle();

    if (fetchError || !enrollment) {
      return NextResponse.json(
        { error: "Enrollment not found" },
        { status: 404 }
      );
    }

    if (action === "pause") {
      const { error } = await supabaseAdmin
        .from("sms_sequence_enrollments")
        .update({ is_paused: true })
        .eq("id", enrollmentId);

      if (error) {
        return NextResponse.json(
          { error: "Failed to pause enrollment" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    if (action === "resume") {
      let nextRunAt = enrollment.next_run_at as string | null;

      if (!nextRunAt && !enrollment.completed_at) {
        nextRunAt = new Date().toISOString();
      }

      const { error } = await supabaseAdmin
        .from("sms_sequence_enrollments")
        .update({
          is_paused: false,
          next_run_at: nextRunAt,
        })
        .eq("id", enrollmentId);

      if (error) {
        return NextResponse.json(
          { error: "Failed to resume enrollment" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Unknown action" },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
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
      .delete()
      .eq("id", enrollmentId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete enrollment" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error" },
      { status: 500 }
    );
  }
}
