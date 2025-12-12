"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Sequence = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
};

export default function SequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newActive, setNewActive] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;
      setUserId(uid);

      if (!uid) {
        setSequences([]);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/sequences?userId=${uid}`);
        const payload = await res.json();
        if (!res.ok) {
          setError((payload as any)?.error || "Failed to load sequences");
          return;
        }
        setSequences((payload as any)?.sequences ?? []);
      } catch (err) {
        setError("Failed to load sequences");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleCreate = async () => {
    if (!userId) {
      setError("You must be signed in.");
      return;
    }
    if (!newName.trim()) {
      setError("Name is required.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          is_active: newActive,
          userId,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError((payload as any)?.error || "Failed to create sequence");
        return;
      }
      const created: Sequence = (payload as any).sequence;
      setSequences((prev) => [created, ...prev]);
      setNewName("");
      setNewActive(true);
    } catch (err) {
      setError("Failed to create sequence");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 text-slate-100">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">SMS Sequences</h1>
          <p className="text-sm text-slate-400">
            Create and manage automated follow-up sequences.
          </p>
        </div>
        <Link
          href="/"
          className="text-xs text-indigo-300 underline underline-offset-4"
        >
          Back to dashboard
        </Link>
      </div>

      <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <h2 className="text-sm font-semibold text-slate-200">New Sequence</h2>
        <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Sequence name"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring focus:ring-indigo-500/60"
          />
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={newActive}
              onChange={(e) => setNewActive(e.target.checked)}
            />
            Active
          </label>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {loading ? "Working…" : "Create"}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-sm text-slate-400">Loading sequences…</div>
        ) : sequences.length === 0 ? (
          <div className="text-sm text-slate-400">
            No sequences yet. Create your first sequence above.
          </div>
        ) : (
          sequences.map((seq) => (
            <Link
              key={seq.id}
              href={`/automation/sequences/${seq.id}`}
              className="block rounded-xl border border-slate-800 bg-slate-900/70 p-4 hover:border-indigo-500/60"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-100">
                    {seq.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    Created {new Date(seq.created_at).toLocaleString()}
                  </div>
                </div>
                <span
                  className={
                    "rounded-full px-2 py-1 text-[11px] font-semibold " +
                    (seq.is_active
                      ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/50"
                      : "bg-slate-800 text-slate-300 border border-slate-700")
                  }
                >
                  {seq.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
