import type {
  ExternalProviderProperty,
  ProviderConfigStatus,
  IntegrationLookupRequest,
} from "@/types/integrations";

const getConfig = (): ProviderConfigStatus & { apiKey?: string; baseUrl?: string } => {
  const apiKey = process.env.PUBLIC_RECORDS_API_KEY;
  const baseUrl = process.env.PUBLIC_RECORDS_API_BASE_URL;
  const missing = [];
  if (!apiKey) missing.push("PUBLIC_RECORDS_API_KEY");
  if (!baseUrl) missing.push("PUBLIC_RECORDS_API_BASE_URL");
  return { configured: missing.length === 0, missing, apiKey, baseUrl };
};

const notImplemented = (label: string) =>
  new Error(`Not implemented: ${label}. Wire real public records API here.`);

export const fetchPublicRecordByAddress = async (
  args: IntegrationLookupRequest
): Promise<ExternalProviderProperty | null> => {
  const cfg = getConfig();
  if (!args.address || !args.city || !args.state || !args.zip) {
    throw new Error("address, city, state, and zip are required for public record lookup");
  }
  if (!cfg.configured) {
    if (process.env.NODE_ENV !== "production") {
      return {
        address: args.address,
        city: args.city,
        state: args.state,
        zip: args.zip,
        ownerName: "Mock Public Records Owner",
        ownerMailingAddress: "PO Box 123, Austin, TX 78701",
        lastSaleDate: new Date().toISOString(),
        lastSalePrice: 450000,
        assessedValue: 430000,
        taxYear: new Date().getFullYear(),
        externalId: "mock-pr-id",
        provider: "public_records",
      };
    }
    throw new Error(
      `Public records provider not configured. Missing: ${cfg.missing.join(", ")}`
    );
  }
  throw notImplemented("Public records fetchPropertyByAddress");
};

export const fetchPublicRecordByExternalId = async (
  externalId: string
): Promise<ExternalProviderProperty | null> => {
  const cfg = getConfig();
  if (!externalId) throw new Error("externalId is required for public record lookup");
  if (!cfg.configured) {
    if (process.env.NODE_ENV !== "production") {
      return {
        address: "456 Mock Ave",
        city: "Austin",
        state: "TX",
        zip: "78702",
        ownerName: "Mock Public Records Owner",
        externalId,
        provider: "public_records",
      };
    }
    throw new Error(
      `Public records provider not configured. Missing: ${cfg.missing.join(", ")}`
    );
  }
  throw notImplemented("Public records fetchPropertyByExternalId");
};

export const fetchPublicRecordsUpdatedSince = async (
  since: Date
): Promise<ExternalProviderProperty[]> => {
  const cfg = getConfig();
  if (!cfg.configured) {
    if (process.env.NODE_ENV !== "production") {
      return [];
    }
    throw new Error(
      `Public records provider not configured. Missing: ${cfg.missing.join(", ")}`
    );
  }
  throw notImplemented(
    `Public records fetchUpdatedPropertiesSince (${since.toISOString()})`
  );
};
