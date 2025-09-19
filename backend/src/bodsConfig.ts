// bodsConfig.ts
export interface BodsConfig {
  apiKey: string;
  operatorIds: string[];     // still used for STATIC GTFS (if available)
  staticUrls: string[];      // one per operator
  vehicleUrls: string[];     // one entry (bbox) for realtime
}

function buildStaticUrl(operatorId: string) {
  // pure URL; the downloader will attach auth (header or ?api_key) robustly
  return `https://data.bus-data.dft.gov.uk/gtfs/feed/${encodeURIComponent(
    operatorId
  )}/latest/download`;
}

// NEW: realtime via bbox on the new GTFS-RT datafeed endpoint
function buildVehicleUrlForBbox(bbox: string, apiKey: string) {
  // boundingBox is "minLat,maxLat,minLon,maxLon"
  const params = new URLSearchParams();
  params.set('api_key', apiKey);
  params.set('boundingBox', bbox);
  return `https://data.bus-data.dft.gov.uk/api/v1/gtfsrtdatafeed/?${params.toString()}`;
}

export function resolveBodsConfig(): BodsConfig {
  const apiKey = process.env.BODS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('BODS_API_KEY is not set. Please provide a Bus Open Data Service API key.');
  }

  // Your chosen operators (used for STATIC feeds only)
  const idsEnv = process.env.BODS_OPERATOR_IDS?.trim() ?? 'SCMN,GNW,FSHL,DTGM';
  const operatorIds = idsEnv.split(',').map((s) => s.trim()).filter(Boolean);

  // REQUIRED for realtime with the new endpoint
  const bbox = process.env.BODS_BBOX?.trim();
  if (!bbox) {
    throw new Error('BODS_BBOX is not set. For the new endpoint you must provide a bounding box: minLat,maxLat,minLon,maxLon');
  }

  return {
    apiKey,
    operatorIds,
    staticUrls: operatorIds.map((id) => buildStaticUrl(id)),
    vehicleUrls: [buildVehicleUrlForBbox(bbox, apiKey)], // single URL using bbox
  };
}
