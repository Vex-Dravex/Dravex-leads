import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

type SavedSearchRow = {
  id: string;
  user_id: string;
  name: string;
  filters: any;
  created_at: string;
};

const mapRow = (row: SavedSearchRow) => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  filters: row.filters,
  createdAt: row.created_at,
});

export async function GET(req: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "userId is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("saved_searches")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load saved searches" },
      { status: 500 }
    );
  }

  const savedSearches = (data ?? []).map(mapRow);
  return NextResponse.json({ savedSearches });
}

export async function POST(req: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { userId, name, filters } = body || {};

    if (!userId || !name) {
      return NextResponse.json(
        { error: "userId and name are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("saved_searches")
      .insert({
        user_id: userId,
        name,
        filters: filters ?? {},
      })
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Failed to create saved search" },
        { status: 500 }
      );
    }

    return NextResponse.json({ savedSearch: mapRow(data) });
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { id, userId } = body || {};

    if (!id || !userId) {
      return NextResponse.json(
        { error: "id and userId are required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("saved_searches")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete saved search" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }
}
