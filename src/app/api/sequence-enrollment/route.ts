import { NextRequest, NextResponse } from "next/server";
import { cookies as nextCookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

type SequenceStep = {
  step_number: number;
  delay_minutes: number;
};

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies: nextCookies });
    const body = await req.json();
    const { propertyId, sequenceId } = body || {};

    if (!propertyId || !sequenceId) {
      return NextResponse.json(
        { error: "propertyId and sequenceId are required" },
        { status: 400 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const { data: stepData, error: stepError } = await supabase
      .from("sms_sequence_steps")
      .select("step_number, delay_minutes")
      .eq("sequence_id", sequenceId)
      .order("step_number", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (stepError || !stepData) {
      return NextResponse.json(
        { error: "Could not load first step" },
        { status: 400 }
      );
    }

    const firstStep: SequenceStep = stepData;
    const delayMinutes = firstStep.delay_minutes ?? 0;
    const nextRun = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();

    const { data: enrollment, error: insertError } = await supabase
      .from("sms_sequence_enrollments")
      .insert({
        sequence_id: sequenceId,
        property_id: propertyId,
        user_id: user.id,
        current_step: firstStep.step_number,
        next_run_at: nextRun,
        is_paused: false,
      })
      .select("*")
      .single();

    if (insertError || !enrollment) {
      return NextResponse.json(
        { error: "Failed to create enrollment" },
        { status: 400 }
      );
    }

    return NextResponse.json({ enrollment });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: nextCookies });
    const body = await req.json();
    const { enrollmentId, action } = body || {};

    if (!enrollmentId || !action) {
      return NextResponse.json(
        { error: "enrollmentId and action are required" },
        { status: 400 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
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
      let nextRun = enrollment.next_run_at;
      if (!nextRun && !enrollment.completed_at) {
        nextRun = new Date().toISOString();
      }

      const { error } = await supabase
        .from("sms_sequence_enrollments")
        .update({ is_paused: false, next_run_at: nextRun })
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
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: nextCookies });
    const body = await req.json();
    const { enrollmentId } = body || {};

    if (!enrollmentId) {
      return NextResponse.json(
        { error: "enrollmentId is required" },
        { status: 400 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
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
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
