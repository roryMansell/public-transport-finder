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
  updatedAt: string;
  speedKph: number;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: {
      type: 'Point';
      coordinates: [number, number];
    };
    properties: VehiclePosition;
  }>;
}
