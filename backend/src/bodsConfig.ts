export interface BodsConfig {
  apiKey: string;
  operatorId?: string;        // optional (all-operators mode when omitted)
  staticUrl?: string;         // undefined in all-operators mode
  vehiclePositionsUrl: string;
}

function buildStaticUrl(operatorId: string | undefined) {
  const override = process.env.BODS_STATIC_URL?.trim();
  if (override && override.length > 0) return override;

  if (operatorId) {
    return `https://data.bus-data.dft.gov.uk/gtfs/feed/${encodeURIComponent(
      operatorId
    )}/latest/download`;
  }
  // no operatorId -> no single-operator static feed
  return undefined;
}

function buildVehicleUrl(
  operatorId: string | undefined,
  bbox: string | undefined,
  apiKey: string
) {
  const override = process.env.BODS_VEHICLE_URL?.trim();
  if (override && override.length > 0) {
    // If you provide a full override URL via env, we trust it as-is.
    return override;
  }

  const base = 'https://data.bus-data.dft.gov.uk/gtfsrt/vehicle-positions?';
  const params = new URLSearchParams();

  // Include API key as a query param (BODS expects this)
  params.set('api_key', apiKey);

  if (operatorId) params.set('operatorRef', operatorId);
  if (bbox) params.set('bbox', bbox); // "latMin,latMax,lngMin,lngMax"

  return base + params.toString();
}

export function resolveBodsConfig(): BodsConfig {
  const apiKey = process.env.BODS_API_KEY?.trim();
  const operatorId = process.env.BODS_OPERATOR_ID?.trim();
  const bbox = process.env.BODS_BBOX?.trim();

  if (!apiKey) {
    throw new Error('BODS_API_KEY is not set. Please provide a Bus Open Data Service API key.');
  }

  return {
    apiKey,
    operatorId: operatorId || undefined,
    staticUrl: buildStaticUrl(operatorId),
    vehiclePositionsUrl: buildVehicleUrl(operatorId, bbox, apiKey),
  };
}
