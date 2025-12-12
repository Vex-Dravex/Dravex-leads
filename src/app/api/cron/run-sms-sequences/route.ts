import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER;
const testToNumber = process.env.TWILIO_TEST_TO_NUMBER;

const isDevMode =
  process.env.NODE_ENV !== "production" ||
  process.env.SMS_DEV_MODE === "true";

const supabase =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

type Enrollment = {
  id: string;
  sequence_id: string;
  property_id: string;
  user_id: string | null;
  current_step: number | null;
  next_run_at: string;
};

type SequenceStep = {
  id: string;
  step_number: number;
  delay_minutes: number;
  body_template: string;
};

type PropertyRow = {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  seller_phone: string | null;
};

const renderTemplate = (template: string, data: Record<string, string>) =>
  template.replace(/{{\s*(\w+)\s*}}/g, (_, key) => data[key] ?? "");

export async function POST(req: Request) {
  try {
    if (!supabase || !accountSid || !authToken || !fromNumber) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    const secret = req.headers.get("x-cron-secret");
    if (!secret || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: enrollments, error: enrollError } = await supabase
      .from("sms_sequence_enrollments")
      .select("*")
      .lte("next_run_at", new Date().toISOString())
      .eq("is_paused", false)
      .is("completed_at", null)
      .limit(20);

    if (enrollError || !enrollments || enrollments.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    const twilioClient = twilio(accountSid, authToken);
    let processed = 0;

    for (const enrollment of enrollments as Enrollment[]) {
      try {
        const { data: property, error: propErr } = await supabase
          .from("properties")
          .select("id,address,city,state,zip,seller_phone")
          .eq("id", enrollment.property_id)
          .maybeSingle();

        if (propErr || !property) {
          await supabase
            .from("sms_sequence_enrollments")
            .update({ is_paused: true, last_error: "Missing property" })
            .eq("id", enrollment.id);
          continue;
        }

        const { data: steps, error: stepErr } = await supabase
          .from("sms_sequence_steps")
          .select("*")
          .eq("sequence_id", enrollment.sequence_id)
          .order("step_number", { ascending: true });

        if (stepErr || !steps || steps.length === 0) {
          await supabase
            .from("sms_sequence_enrollments")
            .update({ is_paused: true, last_error: "No steps in sequence" })
            .eq("id", enrollment.id);
          continue;
        }

        const currentIdx = steps.findIndex(
          (s: SequenceStep) => s.step_number === enrollment.current_step
        );
        const activeIdx = currentIdx >= 0 ? currentIdx : 0;
        const activeStep = steps[activeIdx] as SequenceStep;

        if (!activeStep) {
          await supabase
            .from("sms_sequence_enrollments")
            .update({ is_paused: true, last_error: "Invalid step" })
            .eq("id", enrollment.id);
          continue;
        }

        const smsBody = renderTemplate(activeStep.body_template || "", {
          address: (property as PropertyRow).address || "",
          city: (property as PropertyRow).city || "",
          state: (property as PropertyRow).state || "",
          zip: (property as PropertyRow).zip || "",
        });

        const targetSellerNumber =
          (property as PropertyRow).seller_phone?.trim() || null;
        const testNumber = (testToNumber ?? "").trim();

        if (!testNumber) {
          return NextResponse.json(
            { error: "TWILIO_TEST_TO_NUMBER is not configured" },
            { status: 500 }
          );
        }

        const toNumber = isDevMode
          ? testNumber
          : targetSellerNumber || testNumber;

        const message = await twilioClient.messages.create({
          to: toNumber,
          from: fromNumber,
          body: smsBody,
        });

        await supabase.from("property_sms_messages").insert({
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

        const nextStep = steps[activeIdx + 1] as SequenceStep | undefined;

        if (nextStep) {
          const nextRun = new Date(
            Date.now() + (nextStep.delay_minutes ?? 0) * 60 * 1000
          ).toISOString();
          await supabase
            .from("sms_sequence_enrollments")
            .update({
              current_step: nextStep.step_number,
              next_run_at: nextRun,
            })
            .eq("id", enrollment.id);
        } else {
          await supabase
            .from("sms_sequence_enrollments")
            .update({
              completed_at: new Date().toISOString(),
              next_run_at: null,
            })
            .eq("id", enrollment.id);
        }

        processed += 1;
      } catch (err: any) {
        await supabase.from("property_sms_messages").insert({
          property_id: enrollment.property_id,
          user_id: enrollment.user_id,
          to_number: testToNumber || "",
          from_number: fromNumber || "",
          body: "",
          status: "failed",
          source: "sequence",
          provider_message_sid: null,
          error_message: err?.message ?? "Sequence SMS failed",
        });

        await supabase
          .from("sms_sequence_enrollments")
          .update({
            is_paused: true,
            last_error: err?.message ?? "Sequence SMS failed",
          })
          .eq("id", enrollment.id);
      }
    }

    return NextResponse.json({ processed });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Cron error" },
      { status: 500 }
    );
  }
}
