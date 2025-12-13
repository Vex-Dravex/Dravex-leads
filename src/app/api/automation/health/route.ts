import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSmsMode, isSmsLive } from "@/lib/sms";
import type {
  AutomationHealthCheck,
  AutomationHealthResponse,
} from "@/types/automation";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER;

const envName =
  process.env.NODE_ENV === "production"
    ? "production"
    : process.env.NODE_ENV === "test"
    ? "test"
    : "development";

export async function GET() {
  const smsMode = getSmsMode();
  const checks: AutomationHealthCheck[] = [];

  // Supabase connectivity
  if (!supabaseUrl || !serviceRoleKey) {
    checks.push({
      name: "supabase",
      status: "error",
      details: "Missing Supabase configuration",
    });
  } else {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: seqError, count } = await supabase
      .from("sms_sequences")
      .select("id", { count: "exact", head: true });
    checks.push({
      name: "supabase",
      status: seqError ? "error" : "ok",
      details: seqError
        ? seqError.message
        : `sms_sequences accessible (${count ?? 0} total)`,
    });

    // Cron readiness: just check enrollments count
    const { error: enrError, count: enrollmentCount } = await supabase
      .from("sms_sequence_enrollments")
      .select("id", { count: "exact", head: true });
    checks.push({
      name: "cron",
      status: enrError
        ? "error"
        : (enrollmentCount ?? 0) > 0
        ? "ok"
        : "degraded",
      details: enrError
        ? enrError.message
        : (enrollmentCount ?? 0) > 0
        ? `${enrollmentCount} enrollment(s) present`
        : "No enrollments yet",
    });
  }

  // Twilio configuration
  if (isSmsLive()) {
    if (!accountSid || !authToken || !fromNumber) {
      checks.push({
        name: "twilioConfig",
        status: "error",
        details: "Missing Twilio credentials/from number for live mode",
      });
    } else {
      checks.push({
        name: "twilioConfig",
        status: "ok",
        details: "Twilio credentials present (live mode)",
      });
    }
  } else {
    checks.push({
      name: "twilioConfig",
      status: "ok",
      details: "Mock SMS mode – no live sends",
    });
  }

  const status: AutomationHealthResponse["status"] = checks.some(
    (c) => c.status === "error"
  )
    ? "error"
    : checks.some((c) => c.status === "degraded")
    ? "degraded"
    : "ok";

  const body: AutomationHealthResponse = {
    status,
    environment: envName,
    smsMode,
    checks,
  };

  return NextResponse.json(body, { status: status === "error" ? 500 : 200 });
}
