import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase env vars for sequences/:id route");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const { data: sequence, error: seqError } = await supabaseAdmin
      .from("sms_sequences")
      .select("id, user_id, name, is_active, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();

    if (seqError || !sequence) {
      return NextResponse.json(
        { error: "Failed to load sequence" },
        { status: 404 }
      );
    }

    const { data: steps, error: stepsError } = await supabaseAdmin
      .from("sms_sequence_steps")
      .select(
        "id, sequence_id, step_number, delay_minutes, body_template, created_at, updated_at"
      )
      .eq("sequence_id", id)
      .order("step_number", { ascending: true });

    if (stepsError) {
      return NextResponse.json(
        { error: "Failed to load steps" },
        { status: 500 }
      );
    }

    return NextResponse.json({ sequence, steps: steps ?? [] });
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
    const { name, is_active } = body || {};

    if (!name && typeof is_active === "undefined") {
      return NextResponse.json(
        { error: "Nothing to update" },
        { status: 400 }
      );
    }

    const updates: Record<string, any> = {};
    if (name) updates.name = name;
    if (typeof is_active !== "undefined") updates.is_active = !!is_active;

    const { error } = await supabaseAdmin
      .from("sms_sequences")
      .update(updates)
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to update sequence" },
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
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { error } = await supabaseAdmin
      .from("sms_sequences")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to delete sequence" },
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
