export type AutomationSettings = {
  user_id: string;
  timezone: string | null;
  quiet_hours_start: string | null; // "HH:mm" local time
  quiet_hours_end: string | null; // "HH:mm" local time
  enabled: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};
