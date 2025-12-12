import { NextRequest, NextResponse } from "next/server";

type Payload = {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  price?: number;
  to?: string | null;
};

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

    const { address, city, state, zip, price, to } = body || {};

    if (!address || !city || !state || !zip || price === undefined) {
      return NextResponse.json(
        { error: "Missing required property fields" },
        { status: 400 }
      );
    }

    console.info("[/api/text-seller] Stub send:", {
      address,
      city,
      state,
      zip,
      price,
      to: to ?? "test_number",
    });

    // Stub response — integrate Twilio or another provider later.
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[/api/text-seller] error:", error);
    return NextResponse.json(
      { error: "Failed to process request", message: error?.message },
      { status: 500 }
    );
  }
}
