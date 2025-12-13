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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");
  const userId = searchParams.get("userId");

  if (!propertyId || !userId) {
    return NextResponse.json(
      {
        error: "propertyId and userId are required",
        details: "Missing query params",
      },
      { status: 400 }
    );
  }

  try {
    const { data: seqs, error: seqsError } = await supabaseAdmin
      .from("sms_sequences")
      .select("id, user_id, name, is_active, created_at, updated_at")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (seqsError) {
      console.error("[api/sequence-enrollment][GET] sequences", {
        propertyId,
        userId,
        error: seqsError.message,
        code: seqsError.code,
      });
      return NextResponse.json(
        {
          error: "Failed to load sequences",
          details: seqsError.message,
          code: seqsError.code,
        },
        { status: 500 }
      );
    }

    const { data: enrollment, error: enrollmentError } = await supabaseAdmin
      .from("sms_sequence_enrollments")
      .select(
        "id, sequence_id, user_id, property_id, current_step, next_run_at, is_paused, completed_at, last_error, last_error_at, created_at, sequence:sms_sequences(name)"
      )
      .eq("property_id", propertyId)
      .eq("user_id", userId)
      .maybeSingle();

    if (enrollmentError) {
      console.error("[api/sequence-enrollment][GET] enrollment", {
        propertyId,
        userId,
        error: enrollmentError.message,
        code: enrollmentError.code,
      });
      return NextResponse.json(
        {
          error: "Failed to load enrollment",
          details: enrollmentError.message,
          code: enrollmentError.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sequences: seqs ?? [],
      enrollment: enrollment
        ? {
            ...enrollment,
            sequence: enrollment.sequence ? { name: (enrollment as any).sequence.name } : null,
          }
        : null,
    });
  } catch (err: any) {
    console.error("[api/sequence-enrollment][GET] unexpected", {
      propertyId,
      userId,
      error: err?.message,
    });
    return NextResponse.json(
      {
        error: "Unexpected server error",
        details: err?.message,
      },
      { status: 500 }
    );
  }
}

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
      console.error("[api/sequence-enrollment][POST] first step", {
        sequenceId,
        propertyId,
        userId,
        error: stepError?.message,
        code: stepError?.code,
      });
      return NextResponse.json(
        {
          error: "Could not load first step for sequence",
          details: stepError?.message,
          code: stepError?.code,
        },
        { status: 404 }
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
      console.error("[api/sequence-enrollment][POST] create enrollment", {
        propertyId,
        sequenceId,
        userId,
        error: insertError?.message,
        code: insertError?.code,
      });
      return NextResponse.json(
        {
          error: "Failed to create enrollment",
          details: insertError?.message,
          code: insertError?.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ enrollment });
  } catch (err: any) {
    console.error("[api/sequence-enrollment][POST] unexpected", {
      error: err?.message,
    });
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
      console.error("[api/sequence-enrollment][PATCH] fetch enrollment", {
        enrollmentId,
        action,
        error: fetchError?.message,
        code: fetchError?.code,
      });
      return NextResponse.json(
        {
          error: "Enrollment not found",
          details: fetchError?.message,
          code: fetchError?.code,
        },
        { status: 404 }
      );
    }

    if (action === "pause") {
      const { error } = await supabaseAdmin
        .from("sms_sequence_enrollments")
        .update({ is_paused: true })
        .eq("id", enrollmentId);

      if (error) {
        console.error("[api/sequence-enrollment][PATCH] pause", {
          enrollmentId,
          error: error.message,
          code: error.code,
        });
        return NextResponse.json(
          {
            error: "Failed to pause enrollment",
            details: error.message,
            code: error.code,
          },
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
        console.error("[api/sequence-enrollment][PATCH] resume", {
          enrollmentId,
          error: error.message,
          code: error.code,
        });
        return NextResponse.json(
          {
            error: "Failed to resume enrollment",
            details: error.message,
            code: error.code,
          },
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
    console.error("[api/sequence-enrollment][PATCH] unexpected", {
      error: err?.message,
    });
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
      console.error("[api/sequence-enrollment][DELETE] delete", {
        enrollmentId,
        error: error.message,
        code: error.code,
      });
      return NextResponse.json(
        {
          error: "Failed to delete enrollment",
          details: error.message,
          code: error.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[api/sequence-enrollment][DELETE] unexpected", {
      error: err?.message,
    });
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error" },
      { status: 500 }
    );
  }
}
