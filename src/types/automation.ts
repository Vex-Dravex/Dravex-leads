export type AutomationHealthStatus = "ok" | "degraded" | "error";

export type AutomationHealthCheck = {
  name: "supabase" | "twilioConfig" | "cron";
  status: AutomationHealthStatus;
  details?: string;
};

export type AutomationHealthResponse = {
  status: AutomationHealthStatus;
  environment: "production" | "development" | "test";
  smsMode: "live" | "mock";
  checks: AutomationHealthCheck[];
};

/**
 * Ownership & RLS expectations:
 * - sms_sequences, sms_sequence_steps, sms_sequence_enrollments, property_sms_messages
 *   are scoped by user_id; RLS should enforce row access per user/account.
 * - Service-role API routes must still filter by user_id where applicable to avoid
 *   cross-tenant effects even though they bypass RLS.
 */
