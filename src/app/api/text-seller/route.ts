import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

type Payload =
  | {
      propertyId: string;
      to?: string | null;
    }
  | {
      address: string;
      city: string;
      state: string;
      zip: string;
      price: number;
      to?: string | null;
    };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER;
const testToNumber = process.env.TWILIO_TEST_TO_NUMBER;

export async function POST(req: NextRequest) {
  try {
    let body: Payload;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error("[/api/text-seller] Invalid JSON body", parseError);
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    // Prepare property details (propertyId mode preferred).
    let address: string | undefined;
    let city: string | undefined;
    let state: string | undefined;
    let zip: string | undefined;
    let price: number | undefined;
    let sellerPhone: string | null | undefined;

    if ("propertyId" in body && body.propertyId) {
      if (!supabaseUrl || !supabaseServiceKey) {
        console.error(
          "[/api/text-seller] Missing Supabase credentials for property lookup."
        );
        return NextResponse.json(
          { error: "Server not configured for property lookup" },
          { status: 500 }
        );
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data, error } = await supabase
        .from("properties")
        .select(
          "address, city, state, zip, list_price, seller_phone"
        )
        .eq("id", body.propertyId)
        .maybeSingle();

      if (error) {
        console.error("[/api/text-seller] Supabase error:", error);
        return NextResponse.json(
          { error: "Failed to load property" },
          { status: 500 }
        );
      }

      if (!data) {
        return NextResponse.json(
          { error: "Property not found" },
          { status: 404 }
        );
      }

      address = data.address;
      city = data.city;
      state = data.state;
      zip = data.zip;
      price = data.list_price;
      sellerPhone = data.seller_phone;
    } else {
      // Legacy payload
      address = body.address;
      city = body.city;
      state = body.state;
      zip = body.zip;
      price = body.price;
      sellerPhone = body.to ?? null;
    }

    if (!address || !city || !state || !zip || price === undefined) {
      return NextResponse.json(
        { error: "Missing required property fields" },
        { status: 400 }
      );
    }

    const toNumber =
      (body as any).to?.trim?.() ||
      (sellerPhone ?? "").toString().trim() ||
      (testToNumber ?? "").trim();

    if (!toNumber) {
      return NextResponse.json(
        { error: "No destination number configured" },
        { status: 400 }
      );
    }

    if (!accountSid || !authToken || !fromNumber) {
      console.error("[/api/text-seller] Missing Twilio configuration.");
      return NextResponse.json(
        { error: "SMS provider not configured" },
        { status: 500 }
      );
    }

    const client = twilio(accountSid, authToken);

    const bodyText = `New lead from Dravex Leads:
${address}, ${city}, ${state} ${zip}
List price: $${Number(price).toLocaleString()}`;

    await client.messages.create({
      from: fromNumber,
      to: toNumber,
      body: bodyText,
    });

    const usedSellerPhone =
      !!(sellerPhone && sellerPhone.toString().trim()) &&
      !(body as any).to;

    return NextResponse.json({
      success: true,
      usedSellerPhone,
    });
  } catch (error: any) {
    console.error("[/api/text-seller] error:", error);
    return NextResponse.json(
      { error: "Failed to send SMS", message: error?.message },
      { status: 500 }
    );
  }
}
