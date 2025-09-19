import gtfs from 'gtfs-realtime-bindings';
const { transit_realtime } = gtfs;
import Long from 'long';
import type { VehiclePosition } from './types.js';
import type { BodsConfig } from './bodsConfig.js';
import type { RouteGeometry } from './geometry.js';
import { projectPointOntoRoute } from './geometry.js';
import { setStatus } from './status.js';

function resolveTimestamp(vehicleTimestamp?: number | Long | null, headerTimestamp?: number | Long | null) {
  const timestamp = vehicleTimestamp ?? headerTimestamp ?? Math.floor(Date.now() / 1000);
  if (typeof timestamp === 'number') return new Date(timestamp * 1000).toISOString();
  return new Date(timestamp.toNumber() * 1000).toISOString();
}

function resolveSpeed(speedMetersPerSecond?: number | null) {
  if (typeof speedMetersPerSecond !== 'number') return NaN;
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

  let hadAnySuccess = false;
  let sawAnyEntities = false;
  let lastErrorMsg: string | undefined;

  for (const url of config.vehicleUrls) {
    const nowIso = new Date().toISOString();
    try {
      const response = await fetch(url);
      if (!response.ok) {
        feedsDiag.push({
          url, ok: false, httpStatus: response.status, statusText: response.statusText, at: nowIso,
        });
        lastErrorMsg = `Vehicle feed ${url} => ${response.status} ${response.statusText}`;
        console.error(lastErrorMsg);
        continue;
      }

      const ab = await response.arrayBuffer();
      const bytes = ab.byteLength;

      let entitiesCount = 0;
      try {
        const buffer = Buffer.from(ab);
        const feed = transit_realtime.FeedMessage.decode(buffer);
        const entities = feed.entity ?? [];
        entitiesCount = entities.length;

        for (const entity of entities) {
          const vehicle = entity.vehicle;
          if (!vehicle) continue;

          const position = vehicle.position;
          const trip = vehicle.trip;
          if (!position || typeof position.latitude !== 'number' || typeof position.longitude !== 'number') continue;

          const tripId = trip?.tripId ?? undefined;
          const routeId =
            trip?.routeId ??
            (tripId ? tripToRoute.get(tripId) : undefined) ??
            'unknown'; // realtime-only mode

          const geometry = routeId !== 'unknown' ? geometries.get(routeId) : undefined;
          const projection = geometry ? projectPointOntoRoute([position.longitude, position.latitude], geometry) : null;

          const bearing = typeof position.bearing === 'number' ? position.bearing : projection?.bearing ?? 0;
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

        if (entitiesCount > 0) sawAnyEntities = true;

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
      feedsDiag.push({ url, ok: false, error: msg, at: nowIso });
      lastErrorMsg = msg;
    }
  }

  // Update diagnostics
  if (hadAnySuccess) {
    setStatus({
      lastFetchAt: new Date().toISOString(),
      vehiclesCount: vehicles.length,
      lastFetchError: (!sawAnyEntities && 'Realtime feed returned 0 entities for this BBOX') || undefined,
      feeds: feedsDiag,
    });
  } else {
    setStatus({
      lastFetchError: lastErrorMsg,
      feeds: feedsDiag,
    });
  }

  return vehicles;
}
