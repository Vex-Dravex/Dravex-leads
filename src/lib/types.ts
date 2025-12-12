// src/lib/types.ts

export type LeadStage = "new" | "contacted" | "follow_up" | "dead";
export type PropertyStatus = "Active" | "Pending" | "Off Market";

export type Property = {
  id: string;
  mlsId?: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  listPrice: number;
  arv: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  dom: number | null;
  status: PropertyStatus;
  motivationScore: number;
  sellerPhone?: string | null;
  leadStage?: LeadStage | null;
  createdAt?: string;
};

// -----------------------------
// Notes
// -----------------------------
export type PropertyNote = {
  id: string;
  propertyId: string;
  userId: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

// -----------------------------
// Follow-ups
// -----------------------------
export type PropertyFollowUp = {
  id: string;
  propertyId: string;
  userId: string | null;
  title: string;
  dueAt: string;
  createdAt: string;
  completedAt: string | null;
  status: "pending" | "completed";
};

