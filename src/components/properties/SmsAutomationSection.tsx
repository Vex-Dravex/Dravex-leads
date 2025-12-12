"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SmsSequence, SmsSequenceEnrollment } from "@/lib/types";
import { supabase } from "@/lib/supabaseClient";

type SmsAutomationSectionProps = {
  propertyId: string;
  sequences: SmsSequence[];
  enrollment: SmsSequenceEnrollment | null;
  loading: boolean;
  setLoading: (v: boolean) => void;
  setErrorMsg: (msg: string | null) => void;
  onReload: () => Promise<void>;
};

export function SmsAutomationSection({
  propertyId,
  sequences,
  enrollment,
  loading,
  setLoading,
  setErrorMsg,
  onReload,
}: SmsAutomationSectionProps) {
  const router = useRouter();
  const [selectedSequenceId, setSelectedSequenceId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasEnrollment = !!enrollment;

  const statusLabel = useMemo(() => {
    if (!enrollment) return null;
    if (enrollment.completed_at) return "Completed";
    if (enrollment.is_paused) return "Paused";
    return "Active";
  }, [enrollment]);

  const handleEnroll = async () => {
    if (!selectedSequenceId) {
      setError("Select a sequence.");
      return;
    }

    try {
      setIsSubmitting(true);
      setLoading(true);
      setError(null);
      setErrorMsg(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      if (userError || !userId) {
        setError("You must be signed in to enroll.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/sequence-enrollment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          sequenceId: selectedSequenceId,
          userId,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || "Could not enroll.");
        setErrorMsg(payload?.error || "Could not enroll.");
        setLoading(false);
        return;
      }

      await onReload();
      router.refresh();
      setSelectedSequenceId("");
    } catch (err: any) {
      setError(err?.message || "Could not enroll.");
      setErrorMsg(err?.message || "Could not enroll.");
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  const handleAction = async (action: "pause" | "resume") => {
    if (!enrollment) return;

    try {
      setIsSubmitting(true);
      setLoading(true);
      setError(null);
      setErrorMsg(null);

      const res = await fetch("/api/sequence-enrollment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentId: enrollment.id,
          action,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || "Could not update enrollment.");
        setErrorMsg(payload?.error || "Could not update enrollment.");
        setLoading(false);
        return;
      }

      await onReload();
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Could not update enrollment.");
      setErrorMsg(err?.message || "Could not update enrollment.");
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!enrollment) return;
    try {
      setIsSubmitting(true);
      setLoading(true);
      setError(null);
      setErrorMsg(null);

      const res = await fetch("/api/sequence-enrollment", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentId: enrollment.id,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || "Could not cancel enrollment.");
        setErrorMsg(payload?.error || "Could not cancel enrollment.");
        setLoading(false);
        return;
      }

      await onReload();
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Could not cancel enrollment.");
      setErrorMsg(err?.message || "Could not cancel enrollment.");
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          SMS Automation
        </div>
        {(error || loading) && (
          <span className="text-[11px] text-red-300">
            {error || (loading ? "Working…" : "")}
          </span>
        )}
      </div>

      {!hasEnrollment ? (
        <div className="space-y-3 text-xs text-slate-300">
          <p className="text-slate-400">
            Enroll this lead into an automated follow-up sequence.
          </p>
          <div className="flex gap-2">
            <select
              className="flex-1 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs text-slate-100 outline-none ring-purple-500/60 focus:ring"
              value={selectedSequenceId}
              onChange={(e) => setSelectedSequenceId(e.target.value)}
              disabled={loading || sequences.length === 0}
            >
              <option value="">Select sequence…</option>
              {sequences.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleEnroll}
              disabled={
                !selectedSequenceId || isSubmitting || loading || sequences.length === 0
              }
              className="rounded-lg bg-purple-600 px-3 py-2 text-[11px] font-semibold text-slate-100 hover:bg-purple-500 disabled:opacity-60"
            >
              {isSubmitting ? "Working…" : "Enroll"}
            </button>
          </div>
          {sequences.length === 0 && (
            <p className="text-[11px] text-slate-500">
              No active sequences yet. Create one to get started.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3 text-xs text-slate-300">
          <div className="flex items-center justify-between gap-2">
            <div className="text-slate-400">
              Sequence:{" "}
              <span className="text-slate-100">
                {enrollment.sequence?.name ?? enrollment.sequence_id}
              </span>
            </div>
            <span
              className={
                "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] " +
                (enrollment.completed_at
                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/50"
                  : enrollment.is_paused
                  ? "bg-amber-500/10 text-amber-300 border border-amber-500/50"
                  : "bg-indigo-500/10 text-indigo-200 border border-indigo-500/50")
              }
            >
              {statusLabel}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-slate-400">
            <div>
              Current step:{" "}
              <span className="text-slate-100">{enrollment.current_step}</span>
            </div>
            <div>
              Next send:{" "}
              <span className="text-slate-100">
                {enrollment.next_run_at
                  ? new Date(enrollment.next_run_at).toLocaleString()
                  : enrollment.completed_at
                  ? "N/A"
                  : "Pending scheduling"}
              </span>
            </div>
          </div>
          {enrollment.last_error && (
            <div className="text-[11px] text-red-300">
              {enrollment.last_error}
            </div>
          )}

          {!enrollment.completed_at && (
            <div className="flex flex-wrap gap-2">
              {enrollment.is_paused ? (
                <button
                  type="button"
                  disabled={isSubmitting || loading}
                  onClick={() => handleAction("resume")}
                  className="rounded px-3 py-1 text-[11px] font-semibold text-slate-100 bg-purple-600 hover:bg-purple-500 disabled:opacity-60"
                >
                  {isSubmitting ? "Working…" : "Resume"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSubmitting || loading}
                  onClick={() => handleAction("pause")}
                  className="rounded px-3 py-1 text-[11px] font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 disabled:opacity-60"
                >
                  {isSubmitting ? "Working…" : "Pause"}
                </button>
              )}
              <button
                type="button"
                disabled={isSubmitting || loading}
                onClick={handleCancel}
                className="rounded px-3 py-1 text-[11px] font-semibold text-slate-100 bg-red-600 hover:bg-red-500 disabled:opacity-60"
              >
                {isSubmitting ? "Working…" : "Cancel"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
