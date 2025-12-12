import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : null;

export async function PATCH(req: Request) {
  try {
    const client = supabase;
    if (!client) {
      console.error(
        "[/api/properties/seller-phone] Missing Supabase configuration."
      );
      return NextResponse.json(
        { error: "Supabase not configured on server" },
        { status: 500 }
      );
    }

    const { propertyId, sellerPhone } = await req.json();

    if (!propertyId) {
      return NextResponse.json(
        { error: "propertyId is required" },
        { status: 400 }
      );
    }

    const { data, error } = await client
      .from("properties")
      .update({ seller_phone: sellerPhone || null })
      .eq("id", propertyId)
      .select("id, seller_phone")
      .single();

    if (error) {
      console.error("Error updating seller_phone:", error);
      return NextResponse.json(
        { error: "Failed to update seller phone" },
        { status: 500 }
      );
    }

    return NextResponse.json({ property: data });
  } catch (err) {
    console.error("Unexpected error in seller-phone route:", err);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
