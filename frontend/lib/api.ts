const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export interface Route {
  id: string;
  name: string;
  mode: 'bus' | 'tram';
  color: string;
}

export interface Stop {
  id: string;
  name: string;
  routeId: string;
  latitude: number;
  longitude: number;
}

export interface VehiclePosition {
  id: string;
  routeId: string;
  latitude: number;
  longitude: number;
  bearing: number;
  speedKph: number;
  updatedAt: string;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: VehiclePosition;
  }>;
}

async function fetchJson<T>(input: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${input}`);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

export function getRoutes() {
  return fetchJson<Route[]>('/api/routes');
}

export function getStops(routeId?: string) {
  const query = routeId ? `?routeId=${encodeURIComponent(routeId)}` : '';
  return fetchJson<Stop[]>(`/api/stops${query}`);
}

export function getSnapshot() {
  return fetchJson<GeoJsonFeatureCollection>('/api/snapshot');
}
