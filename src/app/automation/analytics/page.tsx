"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type MessageRow = {
  created_at: string;
  status: string;
  source: string | null;
  provider_message_sid: string | null;
  error_message: string | null;
};

type EnrollmentRow = {
  id: string;
  sequence_id: string;
  current_step: number;
  completed_at: string | null;
  next_run_at: string | null;
  last_error: string | null;
  sequence?: { name: string } | null;
};

type SequencePerf = {
  sequence_id: string;
  name: string;
  enrollments: number;
  completions: number;
  failures: number;
};

export default function AutomationAnalyticsPage() {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userId) {
          setLoading(false);
          return;
        }

        const since = new Date();
        since.setDate(since.getDate() - 30);

        const { data: msgData, error: msgErr } = await supabase
          .from("property_sms_messages")
          .select("created_at, status, source, provider_message_sid, error_message")
          .eq("source", "sequence")
          .gte("created_at", since.toISOString());

        if (msgErr) throw new Error(msgErr.message);
        setMessages((msgData as MessageRow[]) ?? []);

        const { data: enrollData, error: enrollErr } = await supabase
          .from("sms_sequence_enrollments")
          .select(
            "id, sequence_id, current_step, completed_at, next_run_at, last_error, sequence:sms_sequences(name)"
          )
          .eq("user_id", userId);

        if (enrollErr) throw new Error(enrollErr.message);
        setEnrollments((enrollData as EnrollmentRow[]) ?? []);
      } catch (err: any) {
        setError(err?.message || "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const kpis = useMemo(() => {
    const total = messages.length;
    const sent = messages.filter((m) => m.status === "sent").length;
    const failed = messages.filter((m) => m.status === "failed").length;
    const lastFailed = messages
      .filter((m) => m.status === "failed")
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];

    const replyCount = messages.filter((m: any) => m.is_reply).length || 0;
    const replyRate = total > 0 ? Math.round((replyCount / total) * 100) : 0;

    return {
      total,
      sent,
      failed,
      successRate: total ? Math.round((sent / total) * 100) : 0,
      failureRate: total ? Math.round((failed / total) * 100) : 0,
      lastFailedAt: lastFailed?.created_at ?? null,
      replyRate,
    };
  }, [messages]);

  const messagesByDay = useMemo(() => {
    const counts: Record<string, number> = {};
    messages.forEach((m) => {
      const day = m.created_at.split("T")[0];
      counts[day] = (counts[day] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => (a.day > b.day ? 1 : -1));
  }, [messages]);

  const sequencePerf: SequencePerf[] = useMemo(() => {
    const map: Record<string, SequencePerf> = {};
    enrollments.forEach((e) => {
      const key = e.sequence_id;
      if (!map[key]) {
        map[key] = {
          sequence_id: key,
          name: e.sequence?.name ?? key,
          enrollments: 0,
          completions: 0,
          failures: 0,
        };
      }
      map[key].enrollments += 1;
      if (e.completed_at) map[key].completions += 1;
      if (e.last_error) map[key].failures += 1;
    });
    return Object.values(map).sort((a, b) => b.enrollments - a.enrollments);
  }, [enrollments]);

  const stepDropoff = useMemo(() => {
    const counts: Record<number, number> = {};
    enrollments.forEach((e) => {
      counts[e.current_step] = (counts[e.current_step] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([step, count]) => ({ step: Number(step), count }))
      .sort((a, b) => a.step - b.step);
  }, [enrollments]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 text-slate-100">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Automation Analytics</h1>
          <p className="text-sm text-slate-400">
            Performance of your automated SMS sequences.
          </p>
        </div>
        <Link
          href="/automation/sequences"
          className="text-xs text-indigo-300 underline underline-offset-4"
        >
          Manage sequences
        </Link>
      </div>

      {error && <p className="mb-3 text-xs text-red-300">{error}</p>}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="text-xs text-slate-400">Total Automated SMS</div>
          <div className="text-2xl font-semibold">{kpis.total}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="text-xs text-slate-400">Success Rate</div>
          <div className="text-2xl font-semibold">{kpis.successRate}%</div>
          <div className="text-[11px] text-slate-500">Failed: {kpis.failureRate}%</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="text-xs text-slate-400">Reply Rate (prep)</div>
          <div className="text-2xl font-semibold">{kpis.replyRate}%</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="mb-2 text-sm font-semibold text-slate-200">
            Messages Over Time (30d)
          </div>
          {messagesByDay.length === 0 ? (
            <div className="text-xs text-slate-500">No messages yet.</div>
          ) : (
            <div className="space-y-1 text-[11px]">
              {messagesByDay.map((d) => (
                <div key={d.day} className="flex items-center gap-2">
                  <div className="w-20 text-slate-400">{d.day}</div>
                  <div className="h-2 flex-1 rounded bg-slate-800">
                    <div
                      className="h-2 rounded bg-indigo-500"
                      style={{ width: `${Math.min(d.count * 10, 100)}%` }}
                    />
                  </div>
                  <div className="w-10 text-right text-slate-300">{d.count}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="mb-2 text-sm font-semibold text-slate-200">
            Sequence Performance
          </div>
          {sequencePerf.length === 0 ? (
            <div className="text-xs text-slate-500">No enrollments yet.</div>
          ) : (
            <div className="space-y-2 text-[11px]">
              {sequencePerf.map((s) => (
                <div
                  key={s.sequence_id}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 p-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-slate-200">{s.name}</div>
                    <div className="text-slate-400">Enrollments: {s.enrollments}</div>
                  </div>
                  <div className="mt-1 flex gap-2 text-slate-400">
                    <span>Completions: {s.completions}</span>
                    <span>Failures: {s.failures}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="mb-2 text-sm font-semibold text-slate-200">
            Step Drop-off
          </div>
          {stepDropoff.length === 0 ? (
            <div className="text-xs text-slate-500">No data.</div>
          ) : (
            <div className="space-y-1 text-[11px]">
              {stepDropoff.map((s) => (
                <div key={s.step} className="flex items-center gap-2">
                  <div className="w-16 text-slate-400">Step {s.step}</div>
                  <div className="h-2 flex-1 rounded bg-slate-800">
                    <div
                      className="h-2 rounded bg-emerald-500"
                      style={{ width: `${Math.min(s.count * 10, 100)}%` }}
                    />
                  </div>
                  <div className="w-10 text-right text-slate-300">{s.count}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="mb-2 text-sm font-semibold text-slate-200">
            Recent Sequence Errors
          </div>
          <ErrorTable />
        </div>
      </div>
    </div>
  );
}

function ErrorTable() {
  const [rows, setRows] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) {
        setRows([]);
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("sms_sequence_enrollments")
        .select(
          "id, sequence_id, current_step, next_run_at, last_error, sequence:sms_sequences(name)"
        )
        .eq("user_id", userId)
        .not("last_error", "is", null)
        .order("next_run_at", { ascending: false })
        .limit(50);

      if (fetchError) throw new Error(fetchError.message);
      setRows((data as EnrollmentRow[]) ?? []);
    } catch (err: any) {
      setError(err?.message || "Failed to load errors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetError = async (id: string) => {
    try {
      const res = await fetch("/api/enrollments/reset-error", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId: id }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        alert((payload as any)?.error || "Failed to reset");
        return;
      }
      load();
    } catch (err) {
      alert("Failed to reset");
    }
  };

  if (loading) return <div className="text-xs text-slate-400">Loading…</div>;
  if (error) return <div className="text-xs text-red-300">{error}</div>;
  if (rows.length === 0)
    return <div className="text-xs text-slate-500">No errors.</div>;

  return (
    <div className="space-y-2 text-[11px]">
      {rows.map((r) => (
        <div
          key={r.id}
          className="rounded-lg border border-slate-800 bg-slate-950/70 p-2"
        >
          <div className="flex items-center justify-between">
            <div className="text-slate-200">
              {r.sequence?.name ?? r.sequence_id} — Step {r.current_step}
            </div>
            <button
              onClick={() => resetError(r.id)}
              className="text-[10px] text-indigo-300 underline"
            >
              Reset
            </button>
          </div>
          <div className="text-slate-400">{r.last_error}</div>
          <div className="text-slate-500">
            Retry at: {r.next_run_at ? new Date(r.next_run_at).toLocaleString() : "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

