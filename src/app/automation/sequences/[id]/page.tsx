"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Sequence, SequenceStep } from "@/types/sequences";
import { supabase } from "@/lib/supabaseClient";

export default function SequenceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sequenceId = params?.id;

  const [sequence, setSequence] = useState<Sequence | null>(null);
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newStepDelay, setNewStepDelay] = useState<number>(0);
  const [newStepBody, setNewStepBody] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!sequenceId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/sequences/${sequenceId}`);
        const payload = res.ok ? await res.json() : null;
        if (!res.ok || !payload?.sequence) {
          setError("Could not load sequence");
          setLoading(false);
          return;
        }
        const seqData = payload.sequence as Sequence;
        setSequence(seqData);

        const stepsData = (payload.steps as SequenceStep[]) ?? [];
        setSteps(stepsData);
      } catch (err) {
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [sequenceId]);

  const handleSaveSequence = async () => {
    if (!sequence) return;
    if (!sequence.name.trim()) {
      setError("Name is required.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/sequences/${sequence.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: sequence.name,
          is_active: sequence.is_active,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError((payload as any)?.error || "Failed to save sequence");
        return;
      }
    } catch (err) {
      setError("Failed to save sequence");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSequence = async () => {
    if (!sequence) return;
    if (!confirm("Delete this sequence? This also removes its steps.")) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/sequences/${sequence.id}`, {
        method: "DELETE",
      });
      const payload = await res.json();
      if (!res.ok) {
        setError((payload as any)?.error || "Failed to delete sequence");
        setLoading(false);
        return;
      }
      router.push("/automation/sequences");
    } catch (err) {
      setError("Failed to delete sequence");
      setLoading(false);
    }
  };

  const handleAddStep = async () => {
    if (!sequenceId) return;
    if (!newStepBody.trim() || newStepDelay < 0) {
      setError("Delay must be >= 0 and body cannot be empty.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/sequences/${sequenceId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delay_minutes: newStepDelay,
          body_template: newStepBody,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError((payload as any)?.error || "Failed to add step");
        setLoading(false);
        return;
      }
      setNewStepDelay(0);
      setNewStepBody("");
      // reload steps
      const { data: stepData } = await supabase
        .from("sms_sequence_steps")
        .select("id, step_number, delay_minutes, body_template")
        .eq("sequence_id", sequenceId)
        .order("step_number", { ascending: true });
      setSteps((stepData as SequenceStep[]) ?? []);
    } catch (err) {
      setError("Failed to add step");
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStep = async (step: SequenceStep) => {
    if (!sequenceId) return;
    if (
      step.delay_minutes !== null &&
      typeof step.delay_minutes === "number" &&
      step.delay_minutes < 0
    ) {
      setError("Delay must be >= 0.");
      return;
    }
    if (!step.body_template || !step.body_template.trim()) {
      setError("Body cannot be empty.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/sequences/${sequenceId}/steps`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepId: step.id,
          delay_minutes: step.delay_minutes ?? 0,
          body_template: step.body_template,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError((payload as any)?.error || "Failed to update step");
        setLoading(false);
        return;
      }
    } catch (err) {
      setError("Failed to update step");
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!sequenceId) return;
    if (!confirm("Delete this step?")) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/sequences/${sequenceId}/steps`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError((payload as any)?.error || "Failed to delete step");
        setLoading(false);
        return;
      }
      const { data: stepData } = await supabase
        .from("sms_sequence_steps")
        .select("id, step_number, delay_minutes, body_template")
        .eq("sequence_id", sequenceId)
        .order("step_number", { ascending: true });
      setSteps((stepData as SequenceStep[]) ?? []);
    } catch (err) {
      setError("Failed to delete step");
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 text-slate-100">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Sequence Builder</h1>
          <p className="text-sm text-slate-400">
            Configure the messages and timing for this sequence.
          </p>
        </div>
        <Link
          href="/automation/sequences"
          className="text-xs text-indigo-300 underline underline-offset-4"
        >
          Back to sequences
        </Link>
      </div>

      {error && <p className="mb-3 text-xs text-red-300">{error}</p>}

      {loading && !sequence ? (
        <div className="text-sm text-slate-400">Loading…</div>
      ) : sequence ? (
        <>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex-1">
                <label className="text-xs text-slate-400">Name</label>
                <input
                  type="text"
                  value={sequence.name}
                  onChange={(e) =>
                    setSequence({ ...sequence, name: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring focus:ring-indigo-500/60"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={sequence.is_active}
                  onChange={(e) =>
                    setSequence({ ...sequence, is_active: e.target.checked })
                  }
                />
                Active
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveSequence}
                  disabled={loading}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  onClick={handleDeleteSequence}
                  disabled={loading}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Created {new Date(sequence.created_at).toLocaleString()}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <h2 className="text-sm font-semibold text-slate-200">Steps</h2>
            <div className="mt-3 space-y-3">
              {steps.length === 0 ? (
                <div className="text-xs text-slate-400">No steps yet.</div>
              ) : (
                steps.map((step) => (
                  <div
                    key={step.id}
                    className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-300">
                        Step {step.step_number}
                      </div>
                      <button
                        onClick={() => handleDeleteStep(step.id)}
                        className="text-[11px] text-red-300 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                    <div className="grid gap-2 md:grid-cols-4">
                      <div className="md:col-span-1">
                        <label className="text-[11px] text-slate-400">
                          Delay (minutes)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={step.delay_minutes ?? 0}
                          onChange={(e) =>
                            setSteps((prev) =>
                              prev.map((s) =>
                                s.id === step.id
                                  ? {
                                      ...s,
                                      delay_minutes: Number(e.target.value),
                                    }
                                  : s
                              )
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring focus:ring-indigo-500/60"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="text-[11px] text-slate-400">
                          Body Template
                        </label>
                        <textarea
                          value={step.body_template ?? ""}
                          onChange={(e) =>
                            setSteps((prev) =>
                              prev.map((s) =>
                                s.id === step.id
                                  ? { ...s, body_template: e.target.value }
                                  : s
                              )
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring focus:ring-indigo-500/60"
                          rows={3}
                        />
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={() => handleUpdateStep(step)}
                        disabled={loading}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
                      >
                        Save Step
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 rounded-lg border border-dashed border-slate-700 p-3">
              <div className="mb-2 text-xs font-semibold text-slate-300">
                Add Step
              </div>
              <div className="grid gap-2 md:grid-cols-4">
                <div className="md:col-span-1">
                  <label className="text-[11px] text-slate-400">
                    Delay (minutes)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newStepDelay}
                    onChange={(e) => setNewStepDelay(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring focus:ring-indigo-500/60"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="text-[11px] text-slate-400">
                    Body Template
                  </label>
                  <textarea
                    value={newStepBody}
                    onChange={(e) => setNewStepBody(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring focus:ring-indigo-500/60"
                    rows={3}
                  />
                </div>
              </div>
              <div className="mt-2 flex justify-end">
                <button
                  onClick={handleAddStep}
                  disabled={loading}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  Add Step
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-sm text-slate-400">Sequence not found.</div>
      )}
    </div>
  );
}
