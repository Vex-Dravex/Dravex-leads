import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase env vars for analytics steps");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function GET(_req: NextRequest) {
  try {
    const { data: sequences, error: seqError } = await supabaseAdmin
      .from("sms_sequences")
      .select("id, name");

    if (seqError) {
      console.error("[api/automation/analytics/steps] sequences", {
        error: seqError.message,
        code: seqError.code,
      });
      return NextResponse.json(
        {
          error: "Failed to load sequences",
          details: seqError.message,
          code: seqError.code,
        },
        { status: 500 }
      );
    }

    const { data: steps, error: stepsError } = await supabaseAdmin
      .from("sms_sequence_steps")
      .select("id, sequence_id, step_number");

    if (stepsError) {
      console.error("[api/automation/analytics/steps] steps", {
        error: stepsError.message,
        code: stepsError.code,
      });
      return NextResponse.json(
        {
          error: "Failed to load steps",
          details: stepsError.message,
          code: stepsError.code,
        },
        { status: 500 }
      );
    }

    const { data: enrollments, error: enrError } = await supabaseAdmin
      .from("sms_sequence_enrollments")
      .select("sequence_id, current_step, is_paused");

    if (enrError) {
      console.error("[api/automation/analytics/steps] enrollments", {
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

    const stepAgg: Record<
      string,
      {
        sequence_id: string;
        sequence_name: string;
        steps: Record<
          number,
          { step_number: number; reached: number; errors: number }
        >;
      }
    > = {};

    (sequences ?? []).forEach((s) => {
      stepAgg[s.id] = {
        sequence_id: s.id,
        sequence_name: s.name,
        steps: {},
      };
    });

    (steps ?? []).forEach((st) => {
      const holder = stepAgg[st.sequence_id];
      if (!holder) return;
      holder.steps[st.step_number] = holder.steps[st.step_number] || {
        step_number: st.step_number,
        reached: 0,
        errors: 0,
      };
    });

    (enrollments ?? []).forEach((enr) => {
      const holder = stepAgg[enr.sequence_id];
      if (!holder) return;
      const currentStep = enr.current_step ?? 0;
      Object.values(holder.steps).forEach((st) => {
        if (currentStep >= st.step_number) {
          st.reached += 1;
          // Without explicit error fields, treat paused enrollments as needing attention.
          if (enr.is_paused && currentStep === st.step_number) {
            st.errors += 1;
          }
        }
      });
    });

    const result = Object.values(stepAgg).map((entry) => ({
      sequence_id: entry.sequence_id,
      sequence_name: entry.sequence_name,
      steps: Object.values(entry.steps).sort(
        (a, b) => a.step_number - b.step_number
      ),
    }));

    return NextResponse.json({ sequences: result });
  } catch (err: any) {
    console.error("[api/automation/analytics/steps] unexpected", {
      error: err?.message,
    });
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
