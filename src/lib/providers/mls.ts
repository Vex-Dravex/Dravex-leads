import type {
  ExternalProviderProperty,
  ProviderConfigStatus,
  IntegrationLookupRequest,
} from "@/types/integrations";

const getConfig = (): ProviderConfigStatus & { apiKey?: string; baseUrl?: string } => {
  const apiKey = process.env.MLS_API_KEY;
  const baseUrl = process.env.MLS_API_BASE_URL;
  const missing = [];
  if (!apiKey) missing.push("MLS_API_KEY");
  if (!baseUrl) missing.push("MLS_API_BASE_URL");
  return { configured: missing.length === 0, missing, apiKey, baseUrl };
};

const notImplemented = (label: string) =>
  new Error(`Not implemented: ${label}. Wire real MLS provider API here.`);

export const fetchMlsPropertyByAddress = async (
  args: IntegrationLookupRequest
): Promise<ExternalProviderProperty | null> => {
  const cfg = getConfig();
  if (!args.address || !args.city || !args.state || !args.zip) {
    throw new Error("address, city, state, and zip are required for MLS lookup");
  }
  if (!cfg.configured) {
    if (process.env.NODE_ENV !== "production") {
      return {
        address: args.address,
        city: args.city,
        state: args.state,
        zip: args.zip,
        bedrooms: 3,
        bathrooms: 2,
        squareFeet: 1800,
        ownerName: "Mock MLS Owner",
        externalId: "mock-mls-id",
        provider: "mls",
      };
    }
    throw new Error(
      `MLS provider not configured. Missing: ${cfg.missing.join(", ")}`
    );
  }
  throw notImplemented("MLS fetchPropertyByAddress");
};

export const fetchMlsPropertyByExternalId = async (
  externalId: string
): Promise<ExternalProviderProperty | null> => {
  const cfg = getConfig();
  if (!externalId) throw new Error("externalId is required for MLS lookup");
  if (!cfg.configured) {
    if (process.env.NODE_ENV !== "production") {
      return {
        address: "123 Mock St",
        city: "Austin",
        state: "TX",
        zip: "78701",
        bedrooms: 4,
        bathrooms: 3,
        squareFeet: 2200,
        externalId,
        provider: "mls",
      };
    }
    throw new Error(
      `MLS provider not configured. Missing: ${cfg.missing.join(", ")}`
    );
  }
  throw notImplemented("MLS fetchPropertyByExternalId");
};

export const fetchMlsUpdatedSince = async (
  since: Date
): Promise<ExternalProviderProperty[]> => {
  const cfg = getConfig();
  if (!cfg.configured) {
    if (process.env.NODE_ENV !== "production") {
      return [];
    }
    throw new Error(
      `MLS provider not configured. Missing: ${cfg.missing.join(", ")}`
    );
  }
  // Replace with real provider API call for delta sync.
  throw notImplemented(`MLS fetchUpdatedPropertiesSince (${since.toISOString()})`);
};
