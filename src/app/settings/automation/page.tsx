"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { AutomationSettings } from "@/types/settings";

const COMMON_TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "UTC",
];

const DEFAULTS = {
  timezone: "America/Los_Angeles",
  quiet_hours_start: "21:00",
  quiet_hours_end: "08:00",
};

export default function AutomationSettingsPage() {
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (!uid) {
        setError("You must be signed in to manage automation settings.");
        return;
      }
      setLoading(true);
      setError(null);
      setSuccess(null);
      try {
        const res = await fetch(`/api/settings/automation?userId=${uid}`);
        const json = await res.json();
        if (!res.ok) {
          setError(json?.error || "Failed to load settings.");
          return;
        }
        const current =
          (json.settings as AutomationSettings | null) ?? {
            user_id: uid,
            timezone: DEFAULTS.timezone,
            quiet_hours_start: DEFAULTS.quiet_hours_start,
            quiet_hours_end: DEFAULTS.quiet_hours_end,
            enabled: true,
          };
        setSettings(current);
      } catch (err: any) {
        console.error(err);
        setError(err?.message || "Failed to load settings.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!userId || !settings) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/settings/automation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          timezone: settings.timezone,
          quietHoursStart: settings.quiet_hours_start,
          quietHoursEnd: settings.quiet_hours_end,
          enabled: settings.enabled,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Failed to save settings.");
        return;
      }
      setSettings(json.settings as AutomationSettings);
      setSuccess("Settings saved.");
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to save settings.");
    } finally {
      setLoading(false);
    }
  };

  if (!userId) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <h1 className="text-lg font-semibold">Automation Settings</h1>
          <p className="text-sm text-slate-400 mt-2">
            Sign in to configure quiet hours and timezone.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-4">
        <header>
          <h1 className="text-lg font-semibold">Automation Settings</h1>
          <p className="text-sm text-slate-400">
            Configure quiet hours and timezone for automated SMS sends.
          </p>
        </header>

        {error && (
          <div className="rounded-md border border-red-500 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-md border border-emerald-500 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
            {success}
          </div>
        )}

        {!settings ? (
          <div className="text-sm text-slate-400">Loading…</div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-200">
                Enable Smart Send Window
              </label>
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) =>
                  setSettings({ ...settings, enabled: e.target.checked })
                }
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Timezone</label>
                <select
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring focus:ring-indigo-500/60"
                  value={settings.timezone ?? ""}
                  onChange={(e) =>
                    setSettings({ ...settings, timezone: e.target.value })
                  }
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">
                    Quiet hours start
                  </label>
                  <input
                    type="time"
                    value={settings.quiet_hours_start ?? ""}
                    onChange={(e) =>
                      setSettings({ ...settings, quiet_hours_start: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring focus:ring-indigo-500/60"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">
                    Quiet hours end
                  </label>
                  <input
                    type="time"
                    value={settings.quiet_hours_end ?? ""}
                    onChange={(e) =>
                      setSettings({ ...settings, quiet_hours_end: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring focus:ring-indigo-500/60"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={loading}
                onClick={handleSave}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-indigo-500 disabled:opacity-60"
              >
                {loading ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
