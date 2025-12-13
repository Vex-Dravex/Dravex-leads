import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSmsMode, sendSmsOrMock } from "@/lib/sms";

type Payload = {
  propertyId?: string;
  userId?: string | null;
  to?: string | null;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  price?: number;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER;
const testToNumber = process.env.TWILIO_TEST_TO_NUMBER;

export async function POST(req: NextRequest) {
  let body: Payload | null = null;
  try {
    let parsed: Payload;
    try {
      parsed = await req.json();
    } catch (parseError) {
      console.error("[/api/text-seller] Invalid JSON body", parseError);
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }
    body = parsed;

    // Prepare property details (propertyId mode preferred).
    let address: string | undefined;
  let city: string | undefined;
  let state: string | undefined;
  let zip: string | undefined;
  let price: number | undefined;
  let sellerPhone: string | null | undefined;

  const smsMode = getSmsMode();

  if ("propertyId" in body && body.propertyId) {
    if (!supabaseUrl || !supabaseServiceKey) {
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

    const targetSellerNumber =
      (body as any).to?.trim?.() || (sellerPhone ?? "").toString().trim() || null;
    const testNumber = (testToNumber ?? "").trim();

    if (!testNumber) {
      return NextResponse.json(
        { error: "TWILIO_TEST_TO_NUMBER is not configured" },
        { status: 500 }
      );
    }

    let toNumber: string;

    toNumber = targetSellerNumber || testNumber;

    if (!toNumber) {
      return NextResponse.json(
        { error: "No destination number configured" },
        { status: 400 }
      );
    }

    const bodyText = `New lead from Dravex Leads:
${address}, ${city}, ${state} ${zip}
List price: $${Number(price).toLocaleString()}`;

    const supabase =
      supabaseUrl && supabaseServiceKey
        ? createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          })
        : null;

    const sendResult = await sendSmsOrMock({
      to: toNumber,
      from: fromNumber || "", // helper will error if missing in live mode
      body: bodyText,
      source: "manual",
      propertyId: body.propertyId,
      userId: body.userId ?? null,
      supabaseClient: supabase ?? undefined,
      twilioAccountSid: accountSid,
      twilioAuthToken: authToken,
      debugLabel: "/api/text-seller",
    });

    if (sendResult.error) {
      return NextResponse.json(
        { error: "Failed to send SMS", details: sendResult.error },
        { status: 500 }
      );
    }

    const usedSellerPhone =
      !!(sellerPhone && sellerPhone.toString().trim()) &&
      !(body as any).to;

    return NextResponse.json({
      success: true,
      usedSellerPhone,
    });
  } catch (error: any) {
    if (supabaseUrl && supabaseServiceKey && body?.propertyId) {
      try {
        const toNumberFallback =
          (body as any).to?.trim?.() ||
          (body as any)?.sellerPhone ||
          (testToNumber ?? "").trim();
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        await supabase.from("property_sms_messages").insert({
          property_id: body.propertyId,
          user_id: body.userId ?? null,
          to_number: toNumberFallback || "",
          from_number: fromNumber || "",
          body: "",
          status: "failed",
          source: "manual",
          provider_message_sid: null,
          error_message: error?.message ?? "SMS failed",
        });
      } catch {
        // ignore logging failures
      }
    }

    return NextResponse.json(
      { error: "Failed to send SMS", details: error?.message },
      { status: 500 }
    );
  }
}
