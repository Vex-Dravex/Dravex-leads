import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER;
const testToNumber = process.env.TWILIO_TEST_TO_NUMBER;
const cronSecret = process.env.CRON_SECRET;

const isDevMode =
  process.env.NODE_ENV !== "production" ||
  process.env.SMS_DEV_MODE === "true";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase environment variables for cron route"
  );
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Enrollment = {
  id: string;
  sequence_id: string;
  property_id: string;
  user_id: string | null;
  current_step: number;
  next_run_at: string | null;
  is_paused: boolean;
  completed_at: string | null;
};

type SequenceStep = {
  id: string;
  sequence_id: string;
  step_number: number;
  delay_minutes: number | null;
  body_template: string | null;
};

type PropertyRow = {
  id: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  list_price: number | null;
  arv: number | null;
  dom: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  seller_phone: string | null;
};

type UserSendWindow = {
  user_id: string;
  enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string | null;
};

const renderTemplate = (template: string, property: PropertyRow) =>
  (template || "")
    .replace(/{{address}}/g, property.address ?? "")
    .replace(/{{city}}/g, property.city ?? "")
    .replace(/{{state}}/g, property.state ?? "")
    .replace(/{{zip}}/g, property.zip ?? "")
    .replace(/{{price}}/g, property.list_price?.toString() ?? "")
    .replace(/{{arv}}/g, property.arv?.toString() ?? "")
    .replace(/{{dom}}/g, property.dom?.toString() ?? "")
    .replace(/{{beds}}/g, property.beds?.toString() ?? "")
    .replace(/{{baths}}/g, property.baths?.toString() ?? "")
    .replace(/{{sqft}}/g, property.sqft?.toString() ?? "");

const isWithinQuietHours = (
  setting: UserSendWindow | null,
  now: Date
) => {
  if (!setting || !setting.enabled) return false;
  const tz = setting.timezone || "UTC";

  const formatter = new Intl.DateTimeFormat("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  });

  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  const currentMinutes = hour * 60 + minute;

  const startParts = (setting.quiet_hours_start || "00:00").split(":");
  const endParts = (setting.quiet_hours_end || "00:00").split(":");
  const startMinutes = Number(startParts[0]) * 60 + Number(startParts[1]);
  const endMinutes = Number(endParts[0]) * 60 + Number(endParts[1]);

  if (startMinutes <= endMinutes) {
    // same day window
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  // overnight window
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
};

const nextAllowedTime = (setting: UserSendWindow | null, now: Date) => {
  if (!setting || !setting.enabled || !setting.quiet_hours_end) return null;
  const tz = setting.timezone || "UTC";
  const [endHourStr, endMinStr] = setting.quiet_hours_end.split(":");
  const endHour = Number(endHourStr);
  const endMin = Number(endMinStr);
  const target = new Date(now);
  target.setDate(target.getDate() + 1);
  target.setHours(endHour, endMin, 0, 0);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
  });
  // convert target in tz back to ISO string by parsing formatted string
  const parts = formatter.formatToParts(target);
  const year = Number(parts.find((p) => p.type === "year")?.value || target.getFullYear());
  const month = Number(parts.find((p) => p.type === "month")?.value || target.getMonth() + 1);
  const day = Number(parts.find((p) => p.type === "day")?.value || target.getDate());
  const dateInTz = new Date(Date.UTC(year, month - 1, day, endHour, endMin, 0));
  return dateInTz.toISOString();
};

export async function POST(req: NextRequest) {
  try {
    if (!accountSid || !authToken || !fromNumber) {
      console.error("[cron] Missing Twilio configuration");
      return NextResponse.json(
        { error: "Twilio not configured" },
        { status: 500 }
      );
    }

    const headerSecret = req.headers.get("x-cron-secret");
    if (!cronSecret || headerSecret !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date().toISOString();

    const { data: enrollments, error: enrollmentsError } = await supabaseAdmin
      .from("sms_sequence_enrollments")
      .select("*")
      .is("completed_at", null)
      .eq("is_paused", false)
      .lte("next_run_at", now)
      .order("next_run_at", { ascending: true })
      .limit(20);

    if (enrollmentsError) {
      console.error("[cron] fetch enrollments error", enrollmentsError);
      return NextResponse.json(
        { error: "Failed to fetch enrollments" },
        { status: 500 }
      );
    }

    if (!enrollments || enrollments.length === 0) {
      return NextResponse.json({ processed: 0, succeeded: 0, failed: 0 });
    }

    const twilioClient = twilio(accountSid, authToken);
    let succeeded = 0;
    let failed = 0;

    for (const enrollment of enrollments as Enrollment[]) {
      try {
        const { data: sendSetting } = await supabaseAdmin
          .from("user_smart_send_settings")
          .select("user_id, enabled, quiet_hours_start, quiet_hours_end, timezone")
          .eq("user_id", enrollment.user_id)
          .maybeSingle();

        const { data: step, error: stepError } = await supabaseAdmin
          .from("sms_sequence_steps")
          .select("*")
          .eq("sequence_id", enrollment.sequence_id)
          .eq("step_number", enrollment.current_step)
          .maybeSingle();

        if (stepError || !step) {
          await supabaseAdmin
            .from("sms_sequence_enrollments")
            .update({
              completed_at: new Date().toISOString(),
              next_run_at: null,
              last_error: "Missing step for current_step",
            })
            .eq("id", enrollment.id);
          failed += 1;
          continue;
        }

        const { data: property, error: propertyError } = await supabaseAdmin
          .from("properties")
          .select(
            "id, address, city, state, zip, list_price, arv, dom, beds, baths, sqft, seller_phone"
          )
          .eq("id", enrollment.property_id)
          .maybeSingle();

        if (propertyError || !property) {
          await supabaseAdmin
            .from("sms_sequence_enrollments")
            .update({
              is_paused: true,
              last_error: "Missing property",
            })
            .eq("id", enrollment.id);
          failed += 1;
          continue;
        }

        if (!step.body_template) {
          await supabaseAdmin
            .from("sms_sequence_enrollments")
            .update({
              is_paused: true,
              last_error: "Missing body_template",
            })
            .eq("id", enrollment.id);
          failed += 1;
          continue;
        }

        const smsBody = renderTemplate(step.body_template, property as PropertyRow);

        const targetSellerNumber = (property as PropertyRow).seller_phone?.trim();
        const testNumber = (testToNumber ?? "").trim();

        if (!testNumber) {
          console.error("[cron] TWILIO_TEST_TO_NUMBER not set");
          return NextResponse.json(
            { error: "TWILIO_TEST_TO_NUMBER is not configured" },
            { status: 500 }
          );
        }

        const toNumber = isDevMode
          ? testNumber
          : targetSellerNumber || testNumber;

        const nowDate = new Date();
        if (isWithinQuietHours(sendSetting as UserSendWindow | null, nowDate)) {
          const deferred = nextAllowedTime(sendSetting as UserSendWindow | null, nowDate);
          await supabaseAdmin
            .from("sms_sequence_enrollments")
            .update({
              next_run_at: deferred,
              last_error: "Skipped due to send window",
            })
            .eq("id", enrollment.id);
          continue;
        }

        try {
          const message = await twilioClient.messages.create({
            to: toNumber,
            from: fromNumber!,
            body: smsBody,
          });

          await supabaseAdmin.from("property_sms_messages").insert({
            property_id: enrollment.property_id,
            user_id: enrollment.user_id,
            to_number: toNumber,
            from_number: fromNumber,
            body: smsBody,
            status: "sent",
            source: "sequence",
            provider_message_sid: message.sid ?? null,
            error_message: null,
          });
        } catch (smsErr: any) {
          await supabaseAdmin.from("property_sms_messages").insert({
            property_id: enrollment.property_id,
            user_id: enrollment.user_id,
            to_number: toNumber,
            from_number: fromNumber,
            body: smsBody,
            status: "failed",
            source: "sequence",
            provider_message_sid: null,
            error_message: smsErr?.message ?? "Sequence SMS failed",
          });

          await supabaseAdmin
            .from("sms_sequence_enrollments")
            .update({
              is_paused: true,
              last_error: smsErr?.message ?? "Sequence SMS failed",
            })
            .eq("id", enrollment.id);
          failed += 1;
          continue;
        }

        const { data: nextStep } = await supabaseAdmin
          .from("sms_sequence_steps")
          .select("*")
          .eq("sequence_id", enrollment.sequence_id)
          .gt("step_number", enrollment.current_step)
          .order("step_number", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (nextStep) {
          const newNextRunAt = new Date(
            Date.now() + (nextStep.delay_minutes ?? 0) * 60 * 1000
          ).toISOString();
          await supabaseAdmin
            .from("sms_sequence_enrollments")
            .update({
              current_step: nextStep.step_number,
              next_run_at: newNextRunAt,
              last_error: null,
            })
            .eq("id", enrollment.id);
        } else {
          await supabaseAdmin
            .from("sms_sequence_enrollments")
            .update({
              completed_at: new Date().toISOString(),
              next_run_at: null,
              last_error: null,
            })
            .eq("id", enrollment.id);
        }

        succeeded += 1;
      } catch (err: any) {
        console.error("[cron] Enrollment processing error", err);
        failed += 1;
      }
    }

    return NextResponse.json({
      processed: enrollments.length,
      succeeded,
      failed,
    });
  } catch (err: any) {
    console.error("[cron] Fatal error", err);
    return NextResponse.json(
      { error: err?.message || "Cron error" },
      { status: 500 }
    );
  }
}
