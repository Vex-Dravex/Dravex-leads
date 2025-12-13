"use client";

import React, { useEffect, useState } from "react";
import type { AutomationHealthResponse, AutomationHealthCheck } from "@/types/automation";

type LoadState =
  | { loading: true; error?: null; data?: null }
  | { loading: false; error: string; data?: null }
  | { loading: false; error?: null; data: AutomationHealthResponse };

const statusColor = (status: AutomationHealthCheck["status"]) => {
  switch (status) {
    case "ok":
      return "text-emerald-300";
    case "degraded":
      return "text-amber-300";
    case "error":
      return "text-red-300";
    default:
      return "text-slate-300";
  }
};

export default function AutomationHealthPage() {
  const [state, setState] = useState<LoadState>({ loading: true });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/automation/health");
        const json = (await res.json()) as AutomationHealthResponse;
        if (!res.ok) {
          setState({
            loading: false,
            error: json?.status
              ? `Health check returned ${json.status}`
              : "Failed to load health",
          });
          return;
        }
        setState({ loading: false, data: json });
      } catch (err: any) {
        setState({
          loading: false,
          error: err?.message || "Failed to load health",
        });
      }
    };
    load();
  }, []);

  const { data } = state as { data?: AutomationHealthResponse };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Automation Health</h1>
            <p className="text-sm text-slate-400">
              Quick preflight for Supabase, Twilio, and cron readiness.
            </p>
          </div>
        </header>

        {state.loading ? (
          <div className="text-sm text-slate-400">Checking automation…</div>
        ) : state.error ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            {state.error}
          </div>
        ) : data ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                <div className="text-xs text-slate-400 uppercase tracking-[0.14em]">
                  Environment
                </div>
                <div className="text-lg font-semibold">{data.environment}</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                <div className="text-xs text-slate-400 uppercase tracking-[0.14em]">
                  SMS Mode
                </div>
                <div className="text-lg font-semibold">{data.smsMode}</div>
                <div className="text-[11px] text-slate-500">
                  {data.smsMode === "live"
                    ? "Live Twilio sends enabled"
                    : "Mock mode (no real SMS)"}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                <div className="text-xs text-slate-400 uppercase tracking-[0.14em]">
                  Overall
                </div>
                <div className={`text-lg font-semibold ${statusColor(data.status)}`}>
                  {data.status}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Checks
              </div>
              <div className="space-y-2 text-sm">
                {data.checks.map((check) => (
                  <div
                    key={check.name}
                    className="flex items-center justify-between rounded border border-slate-800 bg-slate-950/60 px-3 py-2"
                  >
                    <div>
                      <div className="text-slate-200">{check.name}</div>
                      {check.details && (
                        <div className="text-[11px] text-slate-500">
                          {check.details}
                        </div>
                      )}
                    </div>
                    <span
                      className={`text-[12px] font-semibold uppercase tracking-[0.12em] ${statusColor(
                        check.status
                      )}`}
                    >
                      {check.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
