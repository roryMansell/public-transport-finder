import type { Route } from './types.js';

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function metresPerDegreeLatitude(latitude: number) {
  return (
    111132.92 -
    559.82 * Math.cos(2 * toRadians(latitude)) +
    1.175 * Math.cos(4 * toRadians(latitude)) -
    0.0023 * Math.cos(6 * toRadians(latitude))
  );
}

function metresPerDegreeLongitude(latitude: number) {
  return 111412.84 * Math.cos(toRadians(latitude)) - 93.5 * Math.cos(3 * toRadians(latitude)) + 0.118 * Math.cos(5 * toRadians(latitude));
}

export interface RouteGeometry {
  routeId: string;
  coordinates: Array<[number, number]>;
  /** Projected planar coordinates relative to the first coordinate (x=east, y=north). */
  projected: Array<{ x: number; y: number }>;
  /** Running sum of distances from the start of the shape for each coordinate. */
  cumulativeDistances: number[];
  totalLength: number;
}

export interface ProjectionResult {
  point: [number, number];
  distanceAlong: number;
  progress: number;
  bearing: number;
}

export function buildRouteGeometry(routeId: string, coordinates: Array<[number, number]>): RouteGeometry {
  if (coordinates.length === 0) {
    return {
      routeId,
      coordinates,
      projected: [],
      cumulativeDistances: [],
      totalLength: 0,
    };
  }

  const [originLng, originLat] = coordinates[0];
  const metresPerLat = metresPerDegreeLatitude(originLat);
  const metresPerLng = metresPerDegreeLongitude(originLat);

  const projected = coordinates.map(([lng, lat]) => ({
    x: (lng - originLng) * metresPerLng,
    y: (lat - originLat) * metresPerLat,
  }));

  const cumulativeDistances: number[] = [0];
  let totalLength = 0;

  for (let i = 1; i < projected.length; i += 1) {
    const prev = projected[i - 1];
    const current = projected[i];
    const dx = current.x - prev.x;
    const dy = current.y - prev.y;
    const segment = Math.sqrt(dx * dx + dy * dy);
    totalLength += segment;
    cumulativeDistances.push(totalLength);
  }

  return {
    routeId,
    coordinates,
    projected,
    cumulativeDistances,
    totalLength,
  };
}

export function projectPointOntoRoute(point: [number, number], geometry: RouteGeometry): ProjectionResult | null {
  if (geometry.coordinates.length === 0 || geometry.projected.length < 2) {
    return null;
  }

  const [originLng, originLat] = geometry.coordinates[0];
  const metresPerLat = metresPerDegreeLatitude(originLat);
  const metresPerLng = metresPerDegreeLongitude(originLat);

  const px = (point[0] - originLng) * metresPerLng;
  const py = (point[1] - originLat) * metresPerLat;

  let bestDistance = Number.POSITIVE_INFINITY;
  let bestSegmentIndex = 0;
  let bestT = 0;

  for (let i = 0; i < geometry.projected.length - 1; i += 1) {
    const start = geometry.projected[i];
    const end = geometry.projected[i + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) {
      continue;
    }
    let t = ((px - start.x) * dx + (py - start.y) * dy) / lengthSquared;
    if (Number.isNaN(t)) {
      t = 0;
    }
    const clampedT = Math.max(0, Math.min(1, t));
    const projX = start.x + clampedT * dx;
    const projY = start.y + clampedT * dy;
    const distanceSquared = (px - projX) * (px - projX) + (py - projY) * (py - projY);
    if (distanceSquared < bestDistance) {
      bestDistance = distanceSquared;
      bestSegmentIndex = i;
      bestT = clampedT;
    }
  }

  const segmentStart = geometry.projected[bestSegmentIndex];
  const segmentEnd = geometry.projected[bestSegmentIndex + 1];
  const segDx = segmentEnd.x - segmentStart.x;
  const segDy = segmentEnd.y - segmentStart.y;
  const segmentLength = Math.sqrt(segDx * segDx + segDy * segDy);

  const distanceAlong = geometry.cumulativeDistances[bestSegmentIndex] + segmentLength * bestT;
  const progress = geometry.totalLength > 0 ? Math.min(1, Math.max(0, distanceAlong / geometry.totalLength)) : 0;

  const projX = segmentStart.x + segDx * bestT;
  const projY = segmentStart.y + segDy * bestT;

  const longitude = originLng + projX / metresPerLng;
  const latitude = originLat + projY / metresPerLat;

  const bearingRad = Math.atan2(segDx, segDy);
  const bearing = (bearingRad * (180 / Math.PI) + 360) % 360;

  return {
    point: [longitude, latitude],
    distanceAlong,
    progress,
    bearing,
  };
}

export function averageCoordinate(route: Route): [number, number] | null {
  if (route.shape.length === 0) {
    return null;
  }
  const sum = route.shape.reduce(
    (acc, coord) => {
      acc[0] += coord[0];
      acc[1] += coord[1];
      return acc;
    },
    [0, 0] as [number, number],
  );
  return [sum[0] / route.shape.length, sum[1] / route.shape.length];
}
