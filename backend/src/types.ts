export interface Route {
  id: string;
  name: string;
  mode: 'bus' | 'tram';
  color: string;
  /**
   * Ordered list of [longitude, latitude] pairs tracing the route using the
   * operator supplied shape geometry. The coordinates are pre-projected into
   * WGS84 so they can be consumed directly by the frontend map component.
   */
  shape: Array<[number, number]>;
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
  /**
   * Normalised progress along the published route shape (0 – start, 1 – end).
   * This is derived by projecting the reported vehicle position onto the route
   * polyline so that even noisy GPS readings can still be displayed along the
   * road alignment.
   */
  progress?: number;
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
