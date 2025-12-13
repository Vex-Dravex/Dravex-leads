"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { ApiErrorInfo } from "@/types/api";

type OverviewResponse = {
  windowDays: number;
  totals: {
    sms: number;
    manualSms: number;
    sequenceSms: number;
    failedSms: number;
  };
  enrollments: {
    active: number;
    paused: number;
    completed: number;
    errored: number;
  };
};

type TimeseriesPoint = {
  date: string;
  total: number;
  manual: number;
  sequence: number;
};

type StepsResponse = {
  sequences: Array<{
    sequence_id: string;
    sequence_name: string;
    steps: Array<{ step_number: number; reached: number; errors: number }>;
  }>;
};

type ErrorsResponse = {
  enrollmentErrors: Array<{
    id: string;
    sequence_id: string;
    property_id: string;
    is_paused: boolean;
    status?: string | null;
    current_step: number;
    next_run_at: string | null;
    created_at: string;
    completed_at?: string | null;
  }>;
  messageErrors: Array<{
    id: string;
    property_id: string;
    source: string | null;
    status: string | null;
    error_message: string | null;
    created_at: string;
  }>;
  windowDays: number;
};

type KPI = {
  title: string;
  value: string;
  sub: string;
};

export default function AutomationAnalyticsPage() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [stepsData, setStepsData] = useState<StepsResponse | null>(null);
  const [errorsData, setErrorsData] = useState<ErrorsResponse | null>(null);

  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingTimeseries, setLoadingTimeseries] = useState(false);
  const [loadingSteps, setLoadingSteps] = useState(false);
  const [loadingErrors, setLoadingErrors] = useState(false);

  const [errorOverview, setErrorOverview] = useState<ApiErrorInfo | null>(null);
  const [errorTimeseries, setErrorTimeseries] = useState<ApiErrorInfo | null>(null);
  const [errorSteps, setErrorSteps] = useState<ApiErrorInfo | null>(null);
  const [errorErrors, setErrorErrors] = useState<ApiErrorInfo | null>(null);

  const parseApiError = async (
    res: Response,
    fallbackUrl: string
  ): Promise<ApiErrorInfo> => {
    const payload = await res.json().catch(() => ({}));
    return {
      status: res.status,
      url: res.url || fallbackUrl,
      error: (payload as any)?.error || res.statusText || "Request failed",
      details: (payload as any)?.details || (payload as any)?.code,
      code: (payload as any)?.code,
    };
  };

  const formatErrorMessage = (err: ApiErrorInfo | null, context: string) => {
    if (!err) return null;
    const status = err.status ?? "unknown";
    const url = err.url ?? context;
    const detail = err.details || err.code;
    const core = err.error || "Unknown error";
    return `${context} request to ${url} (status ${status}): ${core}${
      detail ? ` – ${detail}` : ""
    }`;
  };

  useEffect(() => {
    const fetchOverview = async () => {
      setLoadingOverview(true);
      setErrorOverview(null);
      try {
        const url = "/api/automation/analytics/overview";
        const res = await fetch(url);
        if (!res.ok) {
          setErrorOverview(await parseApiError(res, url));
          return;
        }
        const json = (await res.json()) as OverviewResponse;
        setOverview(json);
      } catch (err: any) {
        console.error(err);
        setErrorOverview({
          url: "/api/automation/analytics/overview",
          error: err?.message || "Failed to load overview",
        });
      } finally {
        setLoadingOverview(false);
      }
    };

    const fetchTimeseries = async () => {
      setLoadingTimeseries(true);
      setErrorTimeseries(null);
      try {
        const url = "/api/automation/analytics/timeseries";
        const res = await fetch(url);
        if (!res.ok) {
          setErrorTimeseries(await parseApiError(res, url));
          return;
        }
        const json = await res.json();
        setTimeseries((json?.series as TimeseriesPoint[]) ?? []);
      } catch (err: any) {
        console.error(err);
        setErrorTimeseries({
          url: "/api/automation/analytics/timeseries",
          error: err?.message || "Failed to load timeseries",
        });
      } finally {
        setLoadingTimeseries(false);
      }
    };

    const fetchSteps = async () => {
      setLoadingSteps(true);
      setErrorSteps(null);
      try {
        const url = "/api/automation/analytics/steps";
        const res = await fetch(url);
        if (!res.ok) {
          setErrorSteps(await parseApiError(res, url));
          return;
        }
        const json = await res.json();
        setStepsData(json as StepsResponse);
      } catch (err: any) {
        console.error(err);
        setErrorSteps({
          url: "/api/automation/analytics/steps",
          error: err?.message || "Failed to load steps analytics",
        });
      } finally {
        setLoadingSteps(false);
      }
    };

    const fetchErrors = async () => {
      setLoadingErrors(true);
      setErrorErrors(null);
      try {
        const url = "/api/automation/analytics/errors";
        const res = await fetch(url);
        if (!res.ok) {
          setErrorErrors(await parseApiError(res, url));
          return;
        }
        const json = await res.json();
        setErrorsData(json as ErrorsResponse);
      } catch (err: any) {
        console.error(err);
        setErrorErrors({
          url: "/api/automation/analytics/errors",
          error: err?.message || "Failed to load errors",
        });
      } finally {
        setLoadingErrors(false);
      }
    };

    fetchOverview();
    fetchTimeseries();
    fetchSteps();
    fetchErrors();
  }, []);

  const kpis: KPI[] = useMemo(() => {
    if (!overview) return [];
    return [
      {
        title: "Total SMS",
        value: overview.totals.sms.toLocaleString(),
        sub: `Last ${overview.windowDays} days`,
      },
      {
        title: "Sequence SMS",
        value: overview.totals.sequenceSms.toLocaleString(),
        sub: "Automated sends",
      },
      {
        title: "Manual SMS",
        value: overview.totals.manualSms.toLocaleString(),
        sub: "Manual sends",
      },
      {
        title: "Failed Sends",
        value: overview.totals.failedSms.toLocaleString(),
        sub: `Last ${overview.windowDays} days`,
      },
      {
        title: "Active Enrollments",
        value: overview.enrollments.active.toLocaleString(),
        sub: "Currently active",
      },
      {
        title: "Paused",
        value: overview.enrollments.paused.toLocaleString(),
        sub: "Waiting",
      },
      {
        title: "Completed",
        value: overview.enrollments.completed.toLocaleString(),
        sub: "Finished sequences",
      },
      {
        title: "Errored",
        value: overview.enrollments.errored.toLocaleString(),
        sub: "Needs attention",
      },
    ];
  }, [overview]);

  const handleResetError = async (enrollmentId: string) => {
    try {
      const url = "/api/automation/analytics/errors/reset";
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId }),
      });
      if (!res.ok) {
        const info = await parseApiError(res, url);
        console.error("Failed to reset error", info);
        setErrorErrors(info);
        return;
      }
      setErrorErrors(null);
      // Refresh errors
      const refUrl = "/api/automation/analytics/errors";
      const ref = await fetch(refUrl);
      if (ref.ok) {
        const json = await ref.json();
        setErrorsData(json as ErrorsResponse);
      } else {
        setErrorErrors(await parseApiError(ref, refUrl));
      }
    } catch (err) {
      console.error(err);
      setErrorErrors({
        url: "/api/automation/analytics/errors/reset",
        error: err instanceof Error ? err.message : "Failed to reset error",
      });
    }
  };

  const overviewErrorText = formatErrorMessage(errorOverview, "Overview");
  const timeseriesErrorText = formatErrorMessage(
    errorTimeseries,
    "Timeseries"
  );
  const stepsErrorText = formatErrorMessage(errorSteps, "Steps analytics");
  const errorsErrorText = formatErrorMessage(errorErrors, "Errors");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Automation Analytics</h1>
            <p className="text-sm text-slate-400">
              Track automated SMS performance, enrollment health, and errors.
            </p>
          </div>
        </header>

        {/* KPI cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {loadingOverview && !overview ? (
            <div className="col-span-4 text-sm text-slate-400">
              Loading overview…
            </div>
          ) : errorOverview ? (
            <div className="col-span-4 text-sm text-red-300">
              {overviewErrorText}
            </div>
          ) : (
            kpis.map((kpi) => (
              <div
                key={kpi.title}
                className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {kpi.title}
                </div>
                <div className="mt-1 text-2xl font-semibold text-slate-100">
                  {kpi.value}
                </div>
                <div className="text-[11px] text-slate-500">{kpi.sub}</div>
              </div>
            ))
          )}
        </div>

        {/* Timeseries + Steps */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">
                Messages over time
              </h2>
              {loadingTimeseries && (
                <span className="text-[11px] text-slate-400">Loading…</span>
              )}
              {timeseriesErrorText && (
                <span className="text-[11px] text-red-300">
                  {timeseriesErrorText}
                </span>
              )}
            </div>
            {timeseries.length === 0 ? (
              <p className="text-xs text-slate-500">No data yet.</p>
            ) : (
              <ul className="space-y-1 text-xs text-slate-300">
                {timeseries.map((p) => (
                  <li
                    key={p.date}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                  >
                    <div className="text-slate-400">{p.date}</div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-100">Total {p.total}</span>
                      <span className="text-purple-300">
                        Seq {p.sequence}
                      </span>
                      <span className="text-slate-200">Man {p.manual}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">
                Step progression
              </h2>
              {loadingSteps && (
                <span className="text-[11px] text-slate-400">Loading…</span>
              )}
              {stepsErrorText && (
                <span className="text-[11px] text-red-300">
                  {stepsErrorText}
                </span>
              )}
            </div>
            {!stepsData || stepsData.sequences.length === 0 ? (
              <p className="text-xs text-slate-500">No step data available.</p>
            ) : (
              <div className="space-y-3">
                {stepsData.sequences.map((seq) => (
                  <div
                    key={seq.sequence_id}
                    className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"
                  >
                    <div className="mb-2 text-xs font-semibold text-slate-200">
                      {seq.sequence_name || seq.sequence_id}
                    </div>
                    <div className="space-y-1 text-[11px] text-slate-300">
                      {seq.steps.length === 0 && (
                        <div className="text-slate-500">No steps defined.</div>
                      )}
                      {seq.steps.map((st) => (
                        <div
                          key={`${seq.sequence_id}-${st.step_number}`}
                          className="flex items-center justify-between rounded border border-slate-800 bg-slate-900/70 px-2 py-1"
                        >
                          <span>Step {st.step_number}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-emerald-300">
                              Reached {st.reached}
                            </span>
                            <span className="text-red-300">
                              Errors {st.errors}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Errors table */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">
              Recent sequence errors
            </h2>
            {loadingErrors && (
              <span className="text-[11px] text-slate-400">Loading…</span>
            )}
            {errorsErrorText && (
              <span className="text-[11px] text-red-300">
                {errorsErrorText}
              </span>
            )}
          </div>
          {!errorsData ||
          (errorsData.enrollmentErrors.length === 0 &&
            errorsData.messageErrors.length === 0) ? (
            <p className="text-xs text-slate-500">No recent errors.</p>
          ) : (
            <div className="space-y-3">
              {errorsData.enrollmentErrors.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-300">
                    Enrollment errors
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-slate-300">
                    {errorsData.enrollmentErrors.map((e) => (
                      <li
                        key={e.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 bg-slate-950/60 px-3 py-2"
                      >
                        <div className="flex flex-col">
                      <span className="text-slate-400">
                        {new Date(e.created_at).toLocaleString()}
                      </span>
                      <span>
                        Seq {e.sequence_id} · Prop {e.property_id} · Step{" "}
                        {e.current_step}
                      </span>
                      {e.is_paused && (
                        <span className="text-red-300">
                          {e.status || "Enrollment paused"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {e.next_run_at && (
                        <span className="text-[11px] text-slate-400">
                          Next: {new Date(e.next_run_at).toLocaleString()}
                        </span>
                      )}
                          <button
                            onClick={() => handleResetError(e.id)}
                            className="rounded bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-100 hover:bg-slate-700"
                          >
                            Reset
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {errorsData.messageErrors.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-300">
                    Message send failures
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-slate-300">
                    {errorsData.messageErrors.map((m) => (
                      <li
                        key={m.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 bg-slate-950/60 px-3 py-2"
                      >
                        <div className="flex flex-col">
                          <span className="text-slate-400">
                            {new Date(m.created_at).toLocaleString()}
                          </span>
                          <span>
                            Prop {m.property_id} · Source {m.source ?? "n/a"}
                          </span>
                          {m.error_message && (
                            <span className="text-red-300">
                              {m.error_message}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-red-300">
                          Status {m.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
