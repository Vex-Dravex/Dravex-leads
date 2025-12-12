import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase env vars for analytics timeseries");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const daysParam = searchParams.get("days");
    const days = daysParam ? Math.max(1, Number(daysParam)) : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from("property_sms_messages")
      .select("created_at, source")
      .gte("created_at", since);

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to load timeseries",
          details: error.message,
          code: error.code,
        },
        { status: 500 }
      );
    }

    const bucket: Record<
      string,
      { date: string; total: number; manual: number; sequence: number }
    > = {};

    (data ?? []).forEach((row) => {
      const d = new Date(row.created_at);
      const dateKey = d.toISOString().slice(0, 10);
      if (!bucket[dateKey]) {
        bucket[dateKey] = { date: dateKey, total: 0, manual: 0, sequence: 0 };
      }
      bucket[dateKey].total += 1;
      if (row.source === "manual") bucket[dateKey].manual += 1;
      if (row.source === "sequence") bucket[dateKey].sequence += 1;
    });

    const series = Object.values(bucket).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return NextResponse.json({ series, windowDays: days });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
