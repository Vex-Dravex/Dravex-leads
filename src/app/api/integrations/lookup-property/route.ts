import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchMlsPropertyByAddress,
  fetchMlsPropertyByExternalId,
} from "@/lib/providers/mls";
import {
  fetchPublicRecordByAddress,
  fetchPublicRecordByExternalId,
} from "@/lib/providers/publicRecords";
import type {
  IntegrationLookupRequest,
  IntegrationLookupResponse,
} from "@/types/integrations";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const jsonError = (
  error: string,
  status: number,
  details?: string,
  code?: string | null
) => NextResponse.json({ error, details: details ?? null, code: code ?? null }, { status });

export async function POST(req: NextRequest) {
  let body: IntegrationLookupRequest;
  try {
    body = await req.json();
  } catch (err: any) {
    return jsonError("Invalid JSON payload", 400, err?.message);
  }

  const provider = body.provider ?? "mls";
  const hasAddress = body.address && body.city && body.state && body.zip;
  if (!body.propertyId && !hasAddress && !body.apn) {
    return jsonError(
      "Provide propertyId or address (address, city, state, zip) or apn",
      400
    );
  }

  let baseAddress = body;
  if (body.propertyId && supabaseUrl && serviceRoleKey) {
    try {
      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, error } = await supabase
        .from("properties")
        .select("id, address, city, state, zip")
        .eq("id", body.propertyId)
        .maybeSingle();
      if (error) {
        return jsonError("Failed to load property", 500, error.message, error.code);
      }
      if (data) {
        baseAddress = {
          ...body,
          address: data.address,
          city: data.city,
          state: data.state,
          zip: data.zip,
        };
      }
    } catch (err: any) {
      return jsonError("Failed to resolve property address", 500, err?.message);
    }
  }

  try {
    let external = null;
    if (provider === "mls") {
      if (body.apn || body.externalId) {
        external = await fetchMlsPropertyByExternalId(
          (body as any).apn || (body as any).externalId
        );
      } else if (baseAddress.address && baseAddress.city && baseAddress.state && baseAddress.zip) {
        external = await fetchMlsPropertyByAddress(baseAddress);
      }
    } else {
      if (body.apn || body.externalId) {
        external = await fetchPublicRecordByExternalId(
          (body as any).apn || (body as any).externalId
        );
      } else if (baseAddress.address && baseAddress.city && baseAddress.state && baseAddress.zip) {
        external = await fetchPublicRecordByAddress(baseAddress);
      }
    }

    const resp: IntegrationLookupResponse = {
      provider,
      propertyId: body.propertyId,
      external,
      note: external
        ? "Stub response. Wire provider API to persist updates."
        : "No data returned from stub provider.",
    };

    return NextResponse.json(resp);
  } catch (err: any) {
    return jsonError(
      "Lookup failed",
      500,
      err?.message ?? "Unknown error",
      err?.code ?? null
    );
  }
}
