import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase env vars for sequence steps route");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { delay_minutes, body_template } = body || {};

    if (
      typeof delay_minutes !== "number" ||
      delay_minutes < 0 ||
      !body_template
    ) {
      return NextResponse.json(
        { error: "delay_minutes >= 0 and body_template are required" },
        { status: 400 }
      );
    }

    const { data: maxStep, error: maxErr } = await supabaseAdmin
      .from("sms_sequence_steps")
      .select("step_number")
      .eq("sequence_id", id)
      .order("step_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxErr) {
      return NextResponse.json(
        { error: "Failed to determine next step number" },
        { status: 500 }
      );
    }

    const nextStepNumber = (maxStep?.step_number ?? 0) + 1;

    const { error } = await supabaseAdmin
      .from("sms_sequence_steps")
      .insert({
        sequence_id: id,
        step_number: nextStepNumber,
        delay_minutes,
        body_template,
      });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to add step" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { stepId, delay_minutes, body_template } = body || {};

    if (!stepId) {
      return NextResponse.json(
        { error: "stepId is required" },
        { status: 400 }
      );
    }

    const updates: Record<string, any> = {};
    if (typeof delay_minutes === "number") updates.delay_minutes = delay_minutes;
    if (typeof body_template === "string") updates.body_template = body_template;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("sms_sequence_steps")
      .update(updates)
      .eq("id", stepId)
      .eq("sequence_id", id);

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to update step" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { stepId } = body || {};

    if (!stepId) {
      return NextResponse.json(
        { error: "stepId is required" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("sms_sequence_steps")
      .delete()
      .eq("id", stepId)
      .eq("sequence_id", id);

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to delete step" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
