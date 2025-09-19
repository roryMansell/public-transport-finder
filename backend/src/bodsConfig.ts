export interface BodsConfig {
  apiKey: string;
  operatorId: string;
  staticUrl: string;
  vehiclePositionsUrl: string;
}

function buildStaticUrl(operatorId: string) {
  const override = process.env.BODS_STATIC_URL?.trim();
  if (override && override.length > 0) {
    return override;
  }
  return `https://data.bus-data.dft.gov.uk/gtfs/feed/${encodeURIComponent(operatorId)}/latest/download`;
}

function buildVehicleUrl(operatorId: string) {
  const override = process.env.BODS_VEHICLE_URL?.trim();
  if (override && override.length > 0) {
    return override;
  }
  return `https://data.bus-data.dft.gov.uk/gtfsrt/vehicle-positions?operatorRef=${encodeURIComponent(operatorId)}`;
}

export function resolveBodsConfig(): BodsConfig {
  const apiKey = process.env.BODS_API_KEY?.trim();
  const operatorId = process.env.BODS_OPERATOR_ID?.trim();
  if (!apiKey) {
    throw new Error('BODS_API_KEY is not set. Please provide a Bus Open Data Service API key.');
  }
  if (!operatorId) {
    throw new Error('BODS_OPERATOR_ID is not set. Please specify the operator reference to ingest.');
  }
  return {
    apiKey,
    operatorId,
    staticUrl: buildStaticUrl(operatorId),
    vehiclePositionsUrl: buildVehicleUrl(operatorId),
  };
}
