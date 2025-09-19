import Long from 'long';
import gtfs from 'gtfs-realtime-bindings';
const { transit_realtime } = gtfs;

import type { VehiclePosition } from './types.js';
import type { BodsConfig } from './bodsConfig.js';
import type { RouteGeometry } from './geometry.js';
import { projectPointOntoRoute } from './geometry.js';

function resolveTimestamp(
  vehicleTimestamp?: number | Long | null,
  headerTimestamp?: number | Long | null
) {
  const ts = vehicleTimestamp ?? headerTimestamp ?? Math.floor(Date.now() / 1000);
  if (typeof ts === 'number') return new Date(ts * 1000).toISOString();
  return new Date(ts.toNumber() * 1000).toISOString();
}

function resolveSpeed(speedMetersPerSecond?: number | null) {
  if (typeof speedMetersPerSecond !== 'number') return NaN;
  return speedMetersPerSecond * 3.6; // m/s -> km/h
}

export async function fetchVehiclePositions(
  config: BodsConfig,
  geometries: Map<string, RouteGeometry>,
  tripToRoute: Map<string, string>,
): Promise<VehiclePosition[]> {
  // Send both header and query-param (URL already has api_key)
  const res = await fetch(config.vehiclePositionsUrl, {
    headers: { 'x-api-key': config.apiKey },
  });
  if (!res.ok) {
    throw new Error(`Failed to load vehicle positions: ${res.status} ${res.statusText}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const feed = transit_realtime.FeedMessage.decode(buf);

  const vehicles: VehiclePosition[] = [];

  for (const entity of feed.entity ?? []) {
    const vehicle = entity.vehicle;
    if (!vehicle) continue;

    const position = vehicle.position;
    const trip = vehicle.trip;

    if (!position || typeof position.latitude !== 'number' || typeof position.longitude !== 'number') {
      continue;
    }

    const tripId = trip?.tripId ?? undefined;
    const routeId = trip?.routeId ?? (tripId ? tripToRoute.get(tripId) : undefined);
    if (!routeId) continue;

    const geometry = geometries.get(routeId);
    const projection = geometry
      ? projectPointOntoRoute([position.longitude, position.latitude], geometry)
      : null;

    const bearing =
      typeof position.bearing === 'number' ? position.bearing : projection?.bearing ?? 0;

    const latitude = projection?.point[1] ?? position.latitude;
    const longitude = projection?.point[0] ?? position.longitude;

    vehicles.push({
      id: vehicle.vehicle?.id ?? entity.id ?? `${routeId}-${vehicles.length}`,
      routeId,
      latitude,
      longitude,
      bearing,
      speedKph: resolveSpeed(position.speed),
      updatedAt: resolveTimestamp(vehicle.timestamp, feed.header?.timestamp),
      progress: projection?.progress,
    });
  }

  return vehicles;
}
