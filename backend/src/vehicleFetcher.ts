// backend/src/vehicleFetcher.ts
import gtfs from 'gtfs-realtime-bindings';
const { transit_realtime } = gtfs;
import Long from 'long';
import type { BodsConfig } from './bodsConfig.js';
import { setStatus } from './status.js';

// Types expected by your frontend
export type VehiclePosition = {
  id: string;
  routeId: string;       // may be "unknown" in realtime-only mode
  latitude: number;
  longitude: number;
  bearing: number;
  speedKph?: number | null;
  updatedAt: string;     // ISO
  progress?: number | null;
};

// Stubs for geometry (we're not projecting onto shapes in realtime-only mode)
export type RouteGeometry = unknown;
export function projectPointOntoRoute(_pt: [number, number], _geom: RouteGeometry) {
  return null as unknown as { point: [number, number]; bearing: number; progress: number } | null;
}

function resolveTimestamp(vehicleTimestamp?: number | Long | null, headerTimestamp?: number | Long | null) {
  const timestamp = vehicleTimestamp ?? headerTimestamp ?? Math.floor(Date.now() / 1000);
  if (typeof timestamp === 'number') return new Date(timestamp * 1000).toISOString();
  return new Date(timestamp.toNumber() * 1000).toISOString();
}

function resolveSpeed(speedMetersPerSecond?: number | null) {
  if (typeof speedMetersPerSecond !== 'number') return null;
  return speedMetersPerSecond * 3.6;
}

export async function fetchVehiclePositions(
  config: BodsConfig,
  geometries: Map<string, RouteGeometry>,
  tripToRoute: Map<string, string>,
): Promise<VehiclePosition[]> {
  const vehicles: VehiclePosition[] = [];
  const feedsDiag: Array<{
    url: string; ok?: boolean; httpStatus?: number; statusText?: string; bytes?: number; entities?: number; error?: string; at?: string;
  }> = [];

  // Surface a clear error if no feeds configured
  if (!config?.vehicleUrls || config.vehicleUrls.length === 0) {
    setStatus({
      lastFetchError: "No vehicle URLs configured. Set BODS_VEHICLE_URL to one or more GTFS-RT endpoints.",
      feeds: [],
    });
    return vehicles;
  }

  let hadAnySuccess = false;
  let sawAnyEntities = false;
  let lastErrorMsg: string | undefined;

  for (const url of config.vehicleUrls) {
    const nowIso = new Date().toISOString();
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const msg = `Vehicle feed ${url} => ${response.status} ${response.statusText}`;
        feedsDiag.push({ url, ok: false, httpStatus: response.status, statusText: response.statusText, at: nowIso });
        lastErrorMsg = msg;
        console.error(msg);
        continue;
      }

      const ab = await response.arrayBuffer();
      const bytes = ab.byteLength;

      try {
        const buffer = Buffer.from(ab);
        const feed = transit_realtime.FeedMessage.decode(buffer);
        const entities = feed.entity ?? [];
        const entitiesCount = entities.length;

        if (entitiesCount > 0) sawAnyEntities = true;

        for (const entity of entities) {
          const vehicle = entity.vehicle;
          if (!vehicle) continue;

          const position = vehicle.position;
          const trip = vehicle.trip;
          if (!position || typeof position.latitude !== 'number' || typeof position.longitude !== 'number') continue;

          const tripId = trip?.tripId ?? undefined;
          // Realtime-only mode: allow "unknown" routeId so we don't drop vehicles
          const routeId =
            trip?.routeId ??
            (tripId ? tripToRoute.get(tripId) : undefined) ??
            'unknown';

          const projection = null; // no geometry in realtime-only
          const bearing = typeof position.bearing === 'number' ? position.bearing : projection?.bearing ?? 0;

          vehicles.push({
            id: vehicle.vehicle?.id ?? entity.id ?? `${routeId}-${vehicles.length}`,
            routeId,
            latitude: position.latitude,
            longitude: position.longitude,
            bearing,
            speedKph: resolveSpeed(position.speed),
            updatedAt: resolveTimestamp(vehicle.timestamp, feed.header?.timestamp),
            progress: projection?.progress ?? null,
          });
        }

        feedsDiag.push({ url, ok: true, httpStatus: 200, statusText: 'OK', bytes, entities: entitiesCount, at: nowIso });
        hadAnySuccess = true;
        lastErrorMsg = undefined;
      } catch (decodeErr) {
        const msg = `Decode error for ${url}: ${decodeErr instanceof Error ? decodeErr.message : String(decodeErr)}`;
        console.error(msg);
        feedsDiag.push({ url, ok: false, httpStatus: 200, statusText: 'OK (decode failed)', bytes, error: msg, at: nowIso });
        lastErrorMsg = msg;
      }
    } catch (err) {
      const msg = `Fetch error for ${url}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(msg);
      feedsDiag.push({ url, ok: false, error: msg, at: new Date().toISOString() });
      lastErrorMsg = msg;
    }
  }

  if (hadAnySuccess) {
    setStatus({
      lastFetchAt: new Date().toISOString(),
      vehiclesCount: vehicles.length,
      lastFetchError: (!sawAnyEntities && 'Realtime feed returned 0 entities for current URLs') || undefined,
      feeds: feedsDiag,
    });
  } else {
    setStatus({ lastFetchError: lastErrorMsg, feeds: feedsDiag });
  }

  return vehicles;
}
