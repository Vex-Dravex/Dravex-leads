// src/app/api/sequence-enrollment/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

type SequenceStep = {
  step_number: number;
  delay_minutes: number;
};

function createSupabaseServerClient() {
  // Canonical pattern for Next.js App Router route handlers
  return createRouteHandlerClient({ cookies });
}

/**
 * Enroll a property into an SMS sequence.
 * Body: { propertyId: string; sequenceId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { propertyId, sequenceId } = (await req.json()) ?? {};

    if (!propertyId || !sequenceId) {
      return NextResponse.json(
        { error: "propertyId and sequenceId are required" },
        { status: 400 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Not signed in" },
        { status: 401 }
      );
    }

    // Get first step (lowest step_number) for the sequence
    const { data: stepData, error: stepError } = await supabase
      .from("sms_sequence_steps")
      .select<"*", SequenceStep>("step_number, delay_minutes")
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

    const delayMinutes = stepData.delay_minutes ?? 0;
    const nextRunAt = new Date(
      Date.now() + delayMinutes * 60 * 1000
    ).toISOString();

    const { data: enrollment, error: insertError } = await supabase
      .from("sms_sequence_enrollments")
      .insert({
        sequence_id: sequenceId,
        property_id: propertyId,
        user_id: user.id,
        current_step: stepData.step_number,
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
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Update an enrollment (pause/resume).
 * Body: { enrollmentId: string; action: "pause" | "resume" }
 */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { enrollmentId, action } = (await req.json()) ?? {};

    if (!enrollmentId || !action) {
      return NextResponse.json(
        { error: "enrollmentId and action are required" },
        { status: 400 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Not signed in" },
        { status: 401 }
      );
    }

    const { data: enrollment, error: fetchError } = await supabase
      .from("sms_sequence_enrollments")
      .select("*")
      .eq("id", enrollmentId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError || !enrollment) {
      return NextResponse.json(
        { error: "Enrollment not found" },
        { status: 404 }
      );
    }

    if (action === "pause") {
      const { error } = await supabase
        .from("sms_sequence_enrollments")
        .update({ is_paused: true })
        .eq("id", enrollmentId)
        .eq("user_id", user.id);

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

      const { error } = await supabase
        .from("sms_sequence_enrollments")
        .update({
          is_paused: false,
          next_run_at: nextRunAt,
        })
        .eq("id", enrollmentId)
        .eq("user_id", user.id);

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
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Delete an enrollment.
 * Body: { enrollmentId: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { enrollmentId } = (await req.json()) ?? {};

    if (!enrollmentId) {
      return NextResponse.json(
        { error: "enrollmentId is required" },
        { status: 400 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Not signed in" },
        { status: 401 }
      );
    }

    const { error } = await supabase
      .from("sms_sequence_enrollments")
      .delete()
      .eq("id", enrollmentId)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete enrollment" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
