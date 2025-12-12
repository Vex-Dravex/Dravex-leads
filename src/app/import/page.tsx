"use client";

import React, { useEffect, useMemo, useState } from "react";
import Papa, { ParseError, ParseResult } from "papaparse";
import { supabase } from "@/lib/supabaseClient";

type ImportPropertyRow = {
  address: string;
  city: string;
  state: string;
  zip: string;
  list_price: number;
  arv: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  dom: number | null;
  status: "Active" | "Pending" | "Off Market";
  motivation_score: number | null;
  mls_id: string | null;
  seller_phone: string | null;
};

type RawRow = Record<string, string>;

const toNumber = (value: any): number | null => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
};

const normalizeStatus = (value: string | undefined): ImportPropertyRow["status"] => {
  const v = (value || "").trim().toLowerCase();
  if (v === "pending") return "Pending";
  if (v === "off market" || v === "off_market" || v === "offmarket") return "Off Market";
  return "Active";
};

const normalizeRow = (row: RawRow): ImportPropertyRow => ({
  address: (row.address || "").trim(),
  city: (row.city || "").trim(),
  state: (row.state || "").trim(),
  zip: (row.zip || "").trim(),
  list_price: toNumber(row.list_price) ?? 0,
  arv: toNumber(row.arv),
  beds: toNumber(row.beds),
  baths: toNumber(row.baths),
  sqft: toNumber(row.sqft),
  dom: toNumber(row.dom),
  status: normalizeStatus(row.status),
  motivation_score: toNumber(row.motivation_score),
  mls_id: (row.mls_id ?? "").trim() || null,
  seller_phone: (row.seller_phone ?? "").trim() || null,
});

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImportPropertyRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [userPresent, setUserPresent] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUserPresent(!!data.user);
    };
    loadUser();
  }, []);

  const previewRows = useMemo(() => rows.slice(0, 10), [rows]);

  const handleParse = () => {
    if (!file) {
      setParseError("Select a CSV file first.");
      return;
    }
    setParseError(null);
    setImportSuccess(null);
    setImportError(null);
    setIsParsing(true);

    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: ParseResult<RawRow>) => {
        if (results.errors && results.errors.length > 0) {
          setParseError(results.errors[0].message || "Failed to parse CSV.");
          setIsParsing(false);
          return;
        }
        const parsedRows = (results.data || [])
          .map(normalizeRow)
          .filter(
            (r: ImportPropertyRow) =>
              r.address && r.city && r.state && r.zip && r.list_price !== null
          );
        setRows(parsedRows);
        setIsParsing(false);
      },
      error: (err: ParseError) => {
        setParseError(err.message || "Failed to parse CSV.");
        setIsParsing(false);
      },
    });
  };

  const handleImport = async () => {
    if (!rows.length) {
      setImportError("No rows to import. Parse a CSV first.");
      return;
    }
    setImportError(null);
    setImportSuccess(null);
    setIsImporting(true);
    try {
      const res = await fetch("/api/import-properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });

      const payload = await res.json();

      if (!res.ok) {
        setImportError(payload?.error || "Failed to import properties.");
        return;
      }

      setImportSuccess(`Imported ${payload?.inserted ?? rows.length} rows successfully.`);
    } catch (err: any) {
      setImportError(err?.message || "Unexpected error during import.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Import Properties</h1>
            <p className="text-sm text-slate-400">
              Upload a CSV to bulk insert properties into Supabase.
            </p>
          </div>
          {!userPresent && (
            <span className="text-xs text-amber-300">
              Sign in is required to import.
            </span>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-slate-200 file:mr-2 file:rounded-lg file:border file:border-slate-700 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-100 hover:file:bg-slate-700"
              />
              <button
                type="button"
                onClick={handleParse}
                disabled={!file || isParsing || !userPresent}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-indigo-500 disabled:opacity-60"
              >
                {isParsing ? "Parsing…" : "Parse & Preview"}
              </button>
            </div>
            {parseError && <div className="text-xs text-red-300">{parseError}</div>}
          </div>

          {rows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-200">
                  Preview ({rows.length} rows parsed)
                </h2>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={isImporting || !userPresent}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-emerald-500 disabled:opacity-60"
                >
                  {isImporting ? "Importing…" : "Import to Supabase"}
                </button>
              </div>
              {importError && <div className="text-xs text-red-300">{importError}</div>}
              {importSuccess && <div className="text-xs text-emerald-300">{importSuccess}</div>}

              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-800 text-slate-300">
                    <tr>
                      <th className="px-2 py-1 text-left">Address</th>
                      <th className="px-2 py-1 text-left">City</th>
                      <th className="px-2 py-1 text-left">State</th>
                      <th className="px-2 py-1 text-left">Zip</th>
                      <th className="px-2 py-1 text-right">List Price</th>
                      <th className="px-2 py-1 text-right">ARV</th>
                      <th className="px-2 py-1 text-right">Beds</th>
                      <th className="px-2 py-1 text-right">Baths</th>
                      <th className="px-2 py-1 text-right">Sqft</th>
                      <th className="px-2 py-1 text-right">DOM</th>
                      <th className="px-2 py-1 text-left">Status</th>
                      <th className="px-2 py-1 text-right">Motivation</th>
                      <th className="px-2 py-1 text-left">MLS ID</th>
                      <th className="px-2 py-1 text-left">Seller Phone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {previewRows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-2 py-1">{row.address}</td>
                        <td className="px-2 py-1">{row.city}</td>
                        <td className="px-2 py-1">{row.state}</td>
                        <td className="px-2 py-1">{row.zip}</td>
                        <td className="px-2 py-1 text-right">{row.list_price ?? "—"}</td>
                        <td className="px-2 py-1 text-right">{row.arv ?? "—"}</td>
                        <td className="px-2 py-1 text-right">{row.beds ?? "—"}</td>
                        <td className="px-2 py-1 text-right">{row.baths ?? "—"}</td>
                        <td className="px-2 py-1 text-right">{row.sqft ?? "—"}</td>
                        <td className="px-2 py-1 text-right">{row.dom ?? "—"}</td>
                        <td className="px-2 py-1">{row.status}</td>
                        <td className="px-2 py-1 text-right">
                          {row.motivation_score ?? "—"}
                        </td>
                        <td className="px-2 py-1">{row.mls_id ?? "—"}</td>
                        <td className="px-2 py-1">{row.seller_phone ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
