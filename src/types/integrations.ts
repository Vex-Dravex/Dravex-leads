export type ExternalProviderProperty = {
  address: string;
  city: string;
  state: string;
  zip: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  squareFeet?: number | null;
  lotSize?: number | null;
  yearBuilt?: number | null;
  ownerName?: string | null;
  ownerMailingAddress?: string | null;
  lastSaleDate?: string | null;
  lastSalePrice?: number | null;
  assessedValue?: number | null;
  taxYear?: number | null;
  externalId?: string | null;
  provider?: string;
};

export type ProviderConfigStatus = {
  configured: boolean;
  missing: string[];
};

export type IntegrationLookupRequest = {
  propertyId?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  apn?: string;
  externalId?: string;
  provider?: "mls" | "public_records";
};

export type IntegrationLookupResponse = {
  provider: string;
  propertyId?: string;
  external?: ExternalProviderProperty | null;
  note?: string;
};

export type IntegrationSyncResponse = {
  provider: string;
  status: "ok" | "stub";
  message: string;
};
