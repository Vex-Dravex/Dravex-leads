// src/app/api/properties/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Property } from "@/lib/types";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "[/api/properties] Missing Supabase credentials (URL or key)."
    );
    return NextResponse.json(
      { error: "Supabase not configured on server" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data, error } = await supabase
      .from("properties")
      .select(`
        id,
        mls_id,
        address,
        city,
        state,
        zip,
        list_price,
        arv,
        beds,
        baths,
        sqft,
        dom,
        status,
        motivation_score,
        seller_phone,
        lead_stage,
        created_at
      `)
      .order("motivation_score", { ascending: false });

    if (error) {
      console.error("[/api/properties] Supabase error:", error);
      return NextResponse.json(
        {
          error: "Supabase query failed",
          message: error.message,
          details: error.details,
          hint: error.hint,
        },
        { status: 500 }
      );
    }

    const items: Property[] = (data ?? []).map((row: any) => ({
      id: row.id,
      address: row.address,
      city: row.city,
      state: row.state,
      zip: row.zip,
      listPrice: Number(row.list_price),
      arv: row.arv !== null && row.arv !== undefined ? Number(row.arv) : null,
      beds:
        row.beds !== null && row.beds !== undefined ? Number(row.beds) : null,
      baths:
        row.baths !== null && row.baths !== undefined ? Number(row.baths) : null,
      sqft:
        row.sqft !== null && row.sqft !== undefined ? Number(row.sqft) : null,
      dom: row.dom !== null && row.dom !== undefined ? Number(row.dom) : null,
      status: row.status,
      motivationScore: Number(row.motivation_score ?? 0),
      sellerPhone: row.seller_phone ?? null,
      leadStage:
        row.lead_stage !== null && row.lead_stage !== undefined
          ? (row.lead_stage as Property["leadStage"])
          : null,
      createdAt: row.created_at ?? "",
      mlsId: row.mls_id ?? null,
    }));

    return NextResponse.json(items);
  } catch (err: any) {
    console.error("[/api/properties] Unexpected error:", err);
    return NextResponse.json(
      {
        error: "Unexpected error",
        message: err?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}
