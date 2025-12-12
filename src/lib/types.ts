// ---------------------------------------------
// Lead Stages & Status Types
// ---------------------------------------------
export type LeadStage = "new" | "contacted" | "follow_up" | "dead";
export type PropertyStatus = "Active" | "Pending" | "Off Market";

// ---------------------------------------------
// Property (mirrors Supabase `properties` table)
// ---------------------------------------------
export type Property = {
  id: string;

  // DB: mls_id
  mlsId: string | null;

  address: string;
  city: string;
  state: string;
  zip: string;

  // DB: list_price
  listPrice: number;

  arv: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;

  dom: number | null;
  status: PropertyStatus;

  // DB: motivation_score
  motivationScore: number;

  // NEW: seller_phone
  sellerPhone: string | null;

  // DB: lead_stage
  leadStage: LeadStage | null;

  // DB: created_at
  createdAt: string;
};

// ---------------------------------------------
// Notes (`property_notes` table)
// ---------------------------------------------
export type PropertyNote = {
  id: string;

  // DB: property_id
  propertyId: string;

  // DB: user_id
  userId: string | null;

  notes: string;

  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------
// Follow-ups (`property_followups` table)
// ---------------------------------------------
export type PropertyFollowUp = {
  id: string;

  // DB: property_id
  propertyId: string;

  // DB: user_id
  userId: string | null;

  title: string;

  // DB: due_at
  dueAt: string;

  createdAt: string;

  // DB: completed_at
  completedAt: string | null;

  status: "pending" | "completed";
};

