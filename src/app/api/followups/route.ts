import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

const mapFollowup = (row: any) => ({
  id: row.id,
  propertyId: row.property_id,
  userId: row.user_id,
  title: row.title,
  dueAt: row.due_at,
  createdAt: row.created_at,
  completedAt: row.completed_at,
  status: row.status,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { propertyId, title, dueAt } = body;

    if (!propertyId) {
      return NextResponse.json(
        { error: "propertyId is required" },
        { status: 400 }
      );
    }

    const userResp = await supabase.auth.getUser();
    const user = userResp.data.user;

    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("property_followups")
      .insert({
        property_id: propertyId,
        user_id: user.id,
        title: title || "Follow up",
        due_at: dueAt || new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error || !data) {
      console.error("[/api/followups] insert error", error);
      return NextResponse.json(
        { error: "Failed to create follow-up" },
        { status: 500 }
      );
    }

    return NextResponse.json({ followup: mapFollowup(data) });
  } catch (err) {
    console.error("[/api/followups] server error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
