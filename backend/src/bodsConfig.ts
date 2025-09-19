export interface BodsConfig {
  apiKey: string;
  operatorIds: string[];       // one or more operators
  staticUrls: string[];        // one per operator
  vehicleUrls: string[];       // one per operator
}

function buildStaticUrl(operatorId: string) {
  return `https://data.bus-data.dft.gov.uk/gtfs/feed/${encodeURIComponent(
    operatorId
  )}/latest/download`;
}

function buildVehicleUrl(operatorId: string, apiKey: string) {
  const base = 'https://data.bus-data.dft.gov.uk/gtfsrt/vehicle-positions?';
  const params = new URLSearchParams();
  params.set('api_key', apiKey);
  params.set('operatorRef', operatorId);
  return base + params.toString();
}

export function resolveBodsConfig(): BodsConfig {
  const apiKey = process.env.BODS_API_KEY?.trim();
  const idsEnv = process.env.BODS_OPERATOR_IDS?.trim();

  if (!apiKey) {
    throw new Error('BODS_API_KEY is not set. Please provide a Bus Open Data Service API key.');
  }
  if (!idsEnv) {
    throw new Error('BODS_OPERATOR_IDS is not set. Please provide a comma-separated list of operator IDs.');
  }

  const operatorIds = idsEnv.split(',').map((id) => id.trim()).filter(Boolean);

  return {
    apiKey,
    operatorIds,
    staticUrls: operatorIds.map((id) => buildStaticUrl(id)),
    vehicleUrls: operatorIds.map((id) => buildVehicleUrl(id, apiKey)),
  };
}
