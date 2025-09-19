export interface BodsConfig {
  apiKey: string;
  /** Use this if you want exactly one operator (legacy path). */
  operatorId?: string;
  /** NEW: Multiple operators to merge static GTFS from (comma-separated env). */
  operatorIds?: string[];
  /** Only used when operatorId is provided (single feed). */
  staticUrl?: string;
  /** Realtime GTFS-RT endpoint */
  vehiclePositionsUrl: string;
  /** Optional — still supported for realtime; you can leave it unset. */
  bbox?: string;
}

function buildStaticUrl(operatorId: string | undefined) {
  const override = process.env.BODS_STATIC_URL?.trim();
  if (override && override.length > 0) return override;
  if (operatorId) {
    return `https://data.bus-data.dft.gov.uk/gtfs/feed/${encodeURIComponent(
      operatorId
    )}/latest/download`;
  }
  return undefined;
}

function buildVehicleUrl(
  operatorId: string | undefined,
  bbox: string | undefined,
  apiKey: string
) {
  const override = process.env.BODS_VEHICLE_URL?.trim();
  if (override && override.length > 0) {
    return override;
  }

  // Use the documented API v1 endpoint
  const base = 'https://data.bus-data.dft.gov.uk/api/v1/gtfsrtdatafeed/';
  const params = new URLSearchParams();
  params.set('api_key', apiKey);

  // You can keep bbox for performance (optional); unset it if you truly don't want it.
  if (bbox) params.set('bbox', bbox);
  if (operatorId) params.set('operatorRef', operatorId);

  return `${base}?${params.toString()}`;
}

export function resolveBodsConfig(): BodsConfig {
  const apiKey = process.env.BODS_API_KEY?.trim();
  const operatorId = process.env.BODS_OPERATOR_ID?.trim();
  const operatorIdsEnv = process.env.BODS_OPERATOR_IDS?.trim();
  const bbox = process.env.BODS_BBOX?.trim(); // optional

  if (!apiKey) {
    throw new Error('BODS_API_KEY is not set. Please provide a Bus Open Data Service API key.');
  }

  const operatorIds = operatorIdsEnv
    ? operatorIdsEnv.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;

  return {
    apiKey,
    operatorId: operatorId || undefined,
    operatorIds,
    staticUrl: buildStaticUrl(operatorId),
    vehiclePositionsUrl: buildVehicleUrl(operatorId, bbox, apiKey),
    bbox, // harmless if unset
  };
}
