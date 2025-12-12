import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { LeadStage } from "@/lib/types";

const ALLOWED_STAGES: LeadStage[] = [
  "new",
  "contacted",
  "follow_up",
  "dead",
];

export async function PATCH(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(
        "[/api/properties/lead-stage] Missing Supabase URL or service role key."
      );
      return NextResponse.json(
        { error: "Server not configured for Supabase updates" },
        { status: 500 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error("[/api/properties/lead-stage] Invalid JSON body", parseError);
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const { propertyId, leadStage } = body;

    if (!propertyId || !leadStage) {
      return NextResponse.json(
        { error: "propertyId and leadStage are required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_STAGES.includes(leadStage)) {
      return NextResponse.json(
        { error: "Invalid lead stage" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await supabase
      .from("properties")
      .update({ lead_stage: leadStage })
      .eq("id", propertyId)
      .single();

    if (error) {
      console.error("[/api/properties/lead-stage] Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to update lead stage", message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[/api/properties/lead-stage] Unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected error", message: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
