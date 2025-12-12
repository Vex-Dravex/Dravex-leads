import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

type ImportPropertyRow = {
  address: string;
  city: string;
  state: string;
  zip: string;
  list_price: number;
  arv: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  dom: number | null;
  status: "Active" | "Pending" | "Off Market";
  motivation_score: number | null;
  mls_id: string | null;
  seller_phone: string | null;
};

export async function POST(req: Request) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const rows: ImportPropertyRow[] = body?.rows ?? [];

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "No rows provided" },
        { status: 400 }
      );
    }

    const invalid = rows.find(
      (r) =>
        !r.address ||
        !r.city ||
        !r.state ||
        !r.zip ||
        r.list_price === undefined ||
        r.list_price === null
    );

    if (invalid) {
      return NextResponse.json(
        { error: "Missing required fields in one or more rows" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("properties").insert(
      rows.map((r) => ({
        mls_id: r.mls_id,
        address: r.address,
        city: r.city,
        state: r.state,
        zip: r.zip,
        list_price: r.list_price,
        arv: r.arv,
        beds: r.beds,
        baths: r.baths,
        sqft: r.sqft,
        dom: r.dom,
        status: r.status,
        motivation_score: r.motivation_score,
        seller_phone: r.seller_phone,
      }))
    );

    if (error) {
      console.error("[/api/import-properties] insert error", error);
      return NextResponse.json(
        { error: "Failed to import properties" },
        { status: 500 }
      );
    }

    return NextResponse.json({ inserted: rows.length });
  } catch (err) {
    console.error("[/api/import-properties] server error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
