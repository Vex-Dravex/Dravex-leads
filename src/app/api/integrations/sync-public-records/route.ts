import { NextResponse } from "next/server";
import type { IntegrationSyncResponse } from "@/types/integrations";

export const runtime = "nodejs";

export async function POST() {
  const body: IntegrationSyncResponse = {
    provider: "public_records",
    status: "stub",
    message:
      "Public records sync stub. Implement provider fetch and persistence in a future pass.",
  };
  return NextResponse.json(body);
}
