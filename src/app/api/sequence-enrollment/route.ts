import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

type SequenceStep = {
  step_number: number;
  delay_minutes: number;
};

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
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
