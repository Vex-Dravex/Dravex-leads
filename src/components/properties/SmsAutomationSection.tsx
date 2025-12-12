"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SmsSequenceEnrollment, SmsSequenceOption } from "@/lib/types";
import { supabase } from "@/lib/supabaseClient";

type SmsAutomationSectionProps = {
  propertyId: string;
  sequences: SmsSequenceOption[];
  enrollment: SmsSequenceEnrollment | null;
};

export function SmsAutomationSection({
  propertyId,
  sequences,
  enrollment,
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
      setError(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      if (userError || !userId) {
        setError("You must be signed in to enroll.");
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
        return;
      }

      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Could not enroll.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAction = async (action: "pause" | "resume") => {
    if (!enrollment) return;

    try {
      setIsSubmitting(true);
      setError(null);

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
        return;
      }

      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Could not update enrollment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!enrollment) return;
    try {
      setIsSubmitting(true);
      setError(null);

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
        return;
      }

      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Could not cancel enrollment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          SMS Automation
        </div>
        {error && <span className="text-[11px] text-red-300">{error}</span>}
      </div>

      {!hasEnrollment ? (
        <div className="space-y-3 text-xs text-slate-300">
          <p className="text-slate-400">
            Enroll this lead in an automated follow-up sequence.
          </p>
          <div className="flex gap-2">
            <select
              className="flex-1 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs text-slate-100 outline-none ring-purple-500/60 focus:ring"
              value={selectedSequenceId}
              onChange={(e) => setSelectedSequenceId(e.target.value)}
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
              disabled={!selectedSequenceId || isSubmitting}
              className="rounded-lg bg-purple-600 px-3 py-2 text-[11px] font-semibold text-slate-100 hover:bg-purple-500 disabled:opacity-60"
            >
              {isSubmitting ? "Working…" : "Enroll"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 text-xs text-slate-300">
          <div>
            <div className="text-slate-400">
              Enrolled in sequence:{" "}
              <span className="text-slate-100">
                {enrollment.sequence?.name ?? enrollment.sequence_id}
              </span>
            </div>
            <div className="text-slate-400">
              Current step:{" "}
              <span className="text-slate-100">{enrollment.current_step}</span>
            </div>
            <div className="text-slate-400">
              Next send:{" "}
              <span className="text-slate-100">
                {enrollment.next_run_at
                  ? new Date(enrollment.next_run_at).toLocaleString()
                  : "N/A"}
              </span>
            </div>
            <div className="mt-1">
              <span
                className={
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] " +
                  (enrollment.completed_at
                    ? "border border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                    : enrollment.is_paused
                    ? "border border-amber-500/60 bg-amber-500/10 text-amber-300"
                    : "border border-indigo-500/60 bg-indigo-500/10 text-indigo-200")
                }
              >
                {statusLabel}
              </span>
            </div>
            {enrollment.last_error && (
              <div className="mt-1 text-[11px] text-red-300">
                {enrollment.last_error}
              </div>
            )}
          </div>

          {!enrollment.completed_at && (
            <div className="flex flex-wrap gap-2">
              {enrollment.is_paused ? (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleAction("resume")}
                  className="rounded-lg bg-purple-600 px-3 py-1 text-[11px] font-semibold text-slate-100 hover:bg-purple-500 disabled:opacity-60"
                >
                  {isSubmitting ? "Working…" : "Resume"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleAction("pause")}
                  className="rounded-lg border border-slate-700 px-3 py-1 text-[11px] font-semibold text-slate-100 hover:bg-slate-800/80 disabled:opacity-60"
                >
                  {isSubmitting ? "Working…" : "Pause"}
                </button>
              )}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleCancel}
                className="rounded-lg border border-red-700/70 px-3 py-1 text-[11px] font-semibold text-red-200 hover:bg-red-900/40 disabled:opacity-60"
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
