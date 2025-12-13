import twilio from "twilio";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SmsMode = "live" | "mock";

const normalizeMode = (raw?: string | null): SmsMode => {
  const value = (raw || "").toLowerCase();
  if (value === "live" || value === "prod" || value === "production") {
    return "live";
  }
  return "mock";
};

export const getSmsMode = (): SmsMode =>
  normalizeMode(process.env.SMS_MODE || process.env.SMS_DEV_MODE);

export const isSmsLive = () => getSmsMode() === "live";

export type SendSmsResult = {
  mode: SmsMode;
  sent: boolean;
  sid?: string | null;
  error?: string;
};

export type SendSmsOptions = {
  to: string;
  from: string;
  body: string;
  source?: string;
  propertyId?: string;
  userId?: string | null;
  supabaseClient?: SupabaseClient<any, any, any>;
  twilioAccountSid?: string | null;
  twilioAuthToken?: string | null;
  twilioClientOverride?: twilio.Twilio;
  logMock?: boolean;
  debugLabel?: string;
};

const debugLog = (message: string, meta?: any) => {
  if (process.env.DEBUG_AUTOMATION === "true") {
    console.info(message, meta);
  }
};

const logMessage = async (
  supabaseClient: SupabaseClient<any, any, any> | undefined,
  opts: {
    propertyId?: string;
    userId?: string | null;
    to: string;
    from: string;
    body: string;
    status: "sent" | "failed";
    source?: string;
    sid?: string | null;
    errorMessage?: string | null;
  }
) => {
  if (!supabaseClient || !opts.propertyId) return;
  try {
    await supabaseClient.from("property_sms_messages").insert({
      property_id: opts.propertyId,
      user_id: opts.userId ?? null,
      to_number: opts.to,
      from_number: opts.from,
      body: opts.body,
      status: opts.status,
      source: opts.source ?? "manual",
      provider_message_sid: opts.sid ?? null,
      error_message: opts.errorMessage ?? null,
    });
  } catch (err) {
    debugLog("[sms] failed to log message", err);
  }
};

export async function sendSmsOrMock(options: SendSmsOptions): Promise<SendSmsResult> {
  const {
    to,
    from,
    body,
    source,
    propertyId,
    userId,
    supabaseClient,
    twilioAccountSid = process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken = process.env.TWILIO_AUTH_TOKEN,
    twilioClientOverride,
    logMock = true,
    debugLabel,
  } = options;

  const mode = getSmsMode();

  if (mode === "mock") {
    debugLog("[sms] mock send", { to, from, source, debugLabel });
    if (logMock) {
      await logMessage(supabaseClient, {
        propertyId,
        userId,
        to,
        from,
        body,
        status: "sent",
        source: source ? `${source}-mock` : "mock",
        sid: null,
        errorMessage: null,
      });
    }
    return { mode, sent: false, sid: null };
  }

  if (!from) {
    const error = "From number not configured";
    await logMessage(supabaseClient, {
      propertyId,
      userId,
      to,
      from,
      body,
      status: "failed",
      source: source ?? "manual",
      sid: null,
      errorMessage: error,
    });
    return { mode, sent: false, sid: null, error };
  }

  if (!twilioAccountSid || !twilioAuthToken) {
    const error = "Twilio credentials not configured";
    await logMessage(supabaseClient, {
      propertyId,
      userId,
      to,
      from,
      body,
      status: "failed",
      source: source ?? "manual",
      sid: null,
      errorMessage: error,
    });
    return { mode, sent: false, sid: null, error };
  }

  try {
    const client =
      twilioClientOverride || twilio(twilioAccountSid, twilioAuthToken);
    const message = await client.messages.create({ to, from, body });

    await logMessage(supabaseClient, {
      propertyId,
      userId,
      to,
      from,
      body,
      status: "sent",
      source: source ?? "manual",
      sid: message?.sid ?? null,
      errorMessage: null,
    });

    return { mode, sent: true, sid: message?.sid };
  } catch (err: any) {
    const error = err?.message || "SMS send failed";
    await logMessage(supabaseClient, {
      propertyId,
      userId,
      to,
      from,
      body,
      status: "failed",
      source: source ?? "manual",
      sid: null,
      errorMessage: error,
    });
    return { mode, sent: false, sid: null, error };
  }
}
