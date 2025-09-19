export interface BodsConfig {
  apiKey: string;
  vehicleUrls: string[];
}

function buildVehicleUrlForBbox(bbox: string, apiKey: string) {
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

  const bbox = process.env.BODS_BBOX?.trim();
  if (!bbox) {
    throw new Error('BODS_BBOX is not set. Provide a bounding box: minLat,maxLat,minLon,maxLon');
  }

  return {
    apiKey,
    vehicleUrls: [buildVehicleUrlForBbox(bbox, apiKey)],
  };
}
