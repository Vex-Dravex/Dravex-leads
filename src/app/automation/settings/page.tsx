"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type SmartSendSettings = {
  user_id: string;
  enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string | null;
};

export default function AutomationSettingsPage() {
  const [settings, setSettings] = useState<SmartSendSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/user-suggestions/smart-send?userId=${userId}`);
        const payload = await res.json();
        if (!res.ok) {
          setError((payload as any)?.error || "Failed to load settings");
          setLoading(false);
          return;
        }
        setSettings(
          (payload as any).settings ?? {
            user_id: userId,
            enabled: true,
            quiet_hours_start: "20:00",
            quiet_hours_end: "08:00",
            timezone: "UTC",
          }
        );
      } catch (err) {
        setError("Failed to load settings");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/user-suggestions/smart-send`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: settings.user_id,
          enabled: settings.enabled,
          quiet_hours_start: settings.quiet_hours_start,
          quiet_hours_end: settings.quiet_hours_end,
          timezone: settings.timezone,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError((payload as any)?.error || "Failed to save settings");
      }
    } catch (err) {
      setError("Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  if (!settings) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 text-slate-100">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Automation Settings</h1>
          <Link
            href="/automation/analytics"
            className="text-xs text-indigo-300 underline underline-offset-4"
          >
            Analytics
          </Link>
        </div>
        {loading ? (
          <div className="text-sm text-slate-400">Loading…</div>
        ) : (
          <div className="text-sm text-slate-400">Sign in to manage settings.</div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 text-slate-100">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Automation Settings</h1>
        <Link
          href="/automation/analytics"
          className="text-xs text-indigo-300 underline underline-offset-4"
        >
          Analytics
        </Link>
      </div>

      {error && <p className="mb-2 text-xs text-red-300">{error}</p>}

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) =>
              setSettings({ ...settings, enabled: e.target.checked })
            }
          />
          Enable Smart Send Window
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs text-slate-400">Quiet hours start</label>
            <input
              type="time"
              value={settings.quiet_hours_start ?? ""}
              onChange={(e) =>
                setSettings({ ...settings, quiet_hours_start: e.target.value })
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring focus:ring-indigo-500/60"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Quiet hours end</label>
            <input
              type="time"
              value={settings.quiet_hours_end ?? ""}
              onChange={(e) =>
                setSettings({ ...settings, quiet_hours_end: e.target.value })
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring focus:ring-indigo-500/60"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400">Timezone</label>
          <input
            type="text"
            value={settings.timezone ?? ""}
            onChange={(e) =>
              setSettings({ ...settings, timezone: e.target.value })
            }
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring focus:ring-indigo-500/60"
            placeholder="e.g. America/Los_Angeles"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {loading ? "Saving…" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

