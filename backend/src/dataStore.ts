import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';
import { URL } from 'node:url';
import type { Route, Stop } from './types.js';
import { buildRouteGeometry, type RouteGeometry } from './geometry.js';
import { resolveBodsConfig } from './bodsConfig.js';

interface TransitData {
  routes: Route[];
  stops: Stop[];
  geometries: Map<string, RouteGeometry>;
  tripToRoute: Map<string, string>;
}

interface RawRouteRow {
  route_id: string;
  route_short_name?: string;
  route_long_name?: string;
  route_desc?: string;
  route_type?: string;
  route_color?: string;
}

interface RawTripRow {
  route_id: string;
  trip_id: string;
  service_id?: string;
  shape_id?: string;
}

interface RawStopRow {
  stop_id: string;
  stop_name: string;
  stop_lat: string;
  stop_lon: string;
}

interface RawStopTimeRow {
  trip_id: string;
  arrival_time?: string;
  departure_time?: string;
  stop_id: string;
  stop_sequence: string;
}

interface RawShapeRow {
  shape_id: string;
  shape_pt_lat: string;
  shape_pt_lon: string;
  shape_pt_sequence: string;
}

let cachedTransitData: Promise<TransitData> | null = null;

/* ------------------------- helpers ------------------------- */

function parseCsv<T>(zip: AdmZip, entryName: string): T[] {
  const entry = zip.getEntry(entryName);
  if (!entry) throw new Error(`GTFS feed is missing required file: ${entryName}`);
  const content = entry.getData().toString('utf-8');
  return parse(content, { columns: true, skip_empty_lines: true, trim: true }) as T[];
}

function normaliseColor(input?: string) {
  if (!input) return '#005CAB';
  const value = input.startsWith('#') ? input : `#${input}`;
  return /^#([0-9a-fA-F]{6})$/.test(value) ? value : '#005CAB';
}

function resolveMode(routeType?: string): Route['mode'] {
  const numeric = Number(routeType);
  if (Number.isNaN(numeric)) return 'bus';
  switch (numeric) {
    case 0:
    case 1:
      return 'tram';
    case 2:
    case 3:
    default:
      return 'bus';
  }
}

function resolveRouteName(route: RawRouteRow) {
  const shortName = route.route_short_name?.trim();
  const longName = route.route_long_name?.trim();
  if (shortName && longName) return `${shortName} • ${longName}`;
  if (longName) return longName;
  if (shortName) return shortName;
  return route.route_id;
}

function chooseRepresentativeTrip(
  routeId: string,
  trips: RawTripRow[],
  stopTimesByTrip: Map<string, RawStopTimeRow[]>
): RawTripRow | undefined {
  const candidates = trips.filter((trip) => trip.route_id === routeId && trip.shape_id);
  if (candidates.length === 0) return undefined;
  let best: RawTripRow | undefined;
  let bestStopCount = -1;
  for (const trip of candidates) {
    const stopTimes = stopTimesByTrip.get(trip.trip_id) ?? [];
    if (stopTimes.length > bestStopCount) {
      best = trip;
      bestStopCount = stopTimes.length;
    }
  }
  return best;
}

function buildStopsForRoute(
  routeId: string,
  trip: RawTripRow,
  stopTimesByTrip: Map<string, RawStopTimeRow[]>,
  stopsById: Map<string, RawStopRow>
): Stop[] {
  const stopTimes = stopTimesByTrip.get(trip.trip_id);
  if (!stopTimes) return [];
  const sorted = stopTimes
    .map((row) => ({ row, sequence: Number(row.stop_sequence) }))
    .filter((item) => Number.isFinite(item.sequence))
    .sort((a, b) => a.sequence - b.sequence);

  const result: Stop[] = [];
  for (const item of sorted) {
    const row = item.row;
    const stop = stopsById.get(row.stop_id);
    if (!stop) continue;
    const latitude = Number(stop.stop_lat);
    const longitude = Number(stop.stop_lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    result.push({
      id: `${routeId}-${stop.stop_id}`,
      name: stop.stop_name,
      routeId,
      latitude,
      longitude,
    });
  }
  return result;
}

function buildRouteShape(
  shapeId: string | undefined,
  shapesById: Map<string, Array<{ sequence: number; coord: [number, number] }>>
): Array<[number, number]> {
  if (!shapeId) return [];
  const rows = shapesById.get(shapeId);
  if (!rows) return [];
  const ordered = [...rows].sort((a, b) => a.sequence - b.sequence);
  return ordered.map((row) => row.coord);
}

function inBbox(lat: number, lon: number, bbox: string | undefined): boolean {
  if (!bbox) return true;
  const [minLat, maxLat, minLon, maxLon] = bbox.split(',').map(Number);
  return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
}

/* ----------------- operator + GTFS fetching ---------------- */

async function fetchOperatorIds(apiKey: string): Promise<string[]> {
  const resp = await fetch(`https://data.bus-data.dft.gov.uk/api/v1/gtfsoperators/?api_key=${apiKey}`);
  if (!resp.ok) throw new Error(`Failed to list operators: ${resp.status} ${resp.statusText}`);
  const data = await resp.json();
  return (data.operators ?? []).map((op: any) => op.operatorRef);
}

async function downloadStaticFeed(staticUrl: string, apiKey: string): Promise<AdmZip> {
  const response = await fetch(new URL(staticUrl), { headers: { 'x-api-key': apiKey } });
  if (!response.ok) throw new Error(`Failed to download GTFS feed: ${response.status} ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();
  return new AdmZip(Buffer.from(arrayBuffer));
}

/* ------------------ computeTransitData -------------------- */

async function computeTransitData(): Promise<TransitData> {
  const config = resolveBodsConfig();

  let operatorIds: string[];
  if (config.operatorId) {
    operatorIds = [config.operatorId];
  } else {
    operatorIds = await fetchOperatorIds(config.apiKey);
  }

  const routes: Route[] = [];
  const stops: Stop[] = [];
  const geometries = new Map<string, RouteGeometry>();
  const tripToRoute = new Map<string, string>();

  for (const operatorId of operatorIds) {
    try {
      const staticUrl = `https://data.bus-data.dft.gov.uk/gtfs/feed/${encodeURIComponent(operatorId)}/latest/download`;
      const zip = await downloadStaticFeed(staticUrl, config.apiKey);

      const rawRoutes = parseCsv<RawRouteRow>(zip, 'routes.txt');
      const rawTrips = parseCsv<RawTripRow>(zip, 'trips.txt');
      const rawStops = parseCsv<RawStopRow>(zip, 'stops.txt');
      const rawStopTimes = parseCsv<RawStopTimeRow>(zip, 'stop_times.txt');
      const rawShapes = parseCsv<RawShapeRow>(zip, 'shapes.txt');

      const stopTimesByTrip = new Map<string, RawStopTimeRow[]>();
      for (const row of rawStopTimes) {
        if (!stopTimesByTrip.has(row.trip_id)) stopTimesByTrip.set(row.trip_id, []);
        stopTimesByTrip.get(row.trip_id)!.push(row);
      }

      const shapesById = new Map<string, Array<{ sequence: number; coord: [number, number] }>>();
      for (const row of rawShapes) {
        const shapeId = row.shape_id;
        if (!shapeId) continue;
        const latitude = Number(row.shape_pt_lat);
        const longitude = Number(row.shape_pt_lon);
        const sequence = Number(row.shape_pt_sequence);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(sequence)) continue;
        if (!shapesById.has(shapeId)) shapesById.set(shapeId, []);
        shapesById.get(shapeId)!.push({ sequence, coord: [longitude, latitude] });
      }

      const stopsById = new Map<string, RawStopRow>();
      for (const row of rawStops) stopsById.set(row.stop_id, row);

      const tripsByRoute = new Map<string, RawTripRow[]>();
      for (const trip of rawTrips) {
        const prefixedTripId = `${operatorId}:${trip.trip_id}`;
        const prefixedRouteId = `${operatorId}:${trip.route_id}`;
        tripToRoute.set(prefixedTripId, prefixedRouteId);
        if (!tripsByRoute.has(prefixedRouteId)) tripsByRoute.set(prefixedRouteId, []);
        tripsByRoute.get(prefixedRouteId)!.push({ ...trip, trip_id: prefixedTripId, route_id: prefixedRouteId });
      }

      for (const route of rawRoutes) {
        const routeId = `${operatorId}:${route.route_id}`;
        const routeTrips = tripsByRoute.get(routeId) ?? [];
        const representativeTrip = chooseRepresentativeTrip(routeId, routeTrips, stopTimesByTrip);
        const shape = buildRouteShape(representativeTrip?.shape_id, shapesById);
        const geometry = buildRouteGeometry(routeId, shape);
        geometries.set(routeId, geometry);

        const routeObj: Route = {
          id: routeId,
          name: resolveRouteName(route),
          mode: resolveMode(route.route_type),
          color: normaliseColor(route.route_color),
          shape,
        };

        // collect stops
        let routeStops: Stop[] = [];
        if (representativeTrip) {
          routeStops = buildStopsForRoute(routeId, representativeTrip, stopTimesByTrip, stopsById);
        }

        // bbox filter: only keep the route if it has at least one stop inside the bbox
        if (!config.operatorId && config.bbox) {
          const inside = routeStops.some((s) => inBbox(s.latitude, s.longitude, config.bbox));
          if (!inside) continue;
        }

        routes.push(routeObj);
        stops.push(...routeStops);
      }
    } catch (e) {
      console.warn(`Failed to process operator ${operatorId}`, e);
    }
  }

  return { routes, stops, geometries, tripToRoute };
}

/* -------------------------- public API --------------------------- */

async function ensureTransitData(): Promise<TransitData> {
  if (!cachedTransitData) {
    cachedTransitData = computeTransitData();
  }
  return cachedTransitData;
}

export async function loadRoutes(): Promise<Route[]> {
  const data = await ensureTransitData();
  return data.routes;
}

export async function loadStops(): Promise<Stop[]> {
  const data = await ensureTransitData();
  return data.stops;
}

export async function loadStopsForRoute(routeId: string): Promise<Stop[]> {
  const data = await ensureTransitData();
  return data.stops.filter((stop) => stop.routeId === routeId);
}

export async function getRouteGeometries(): Promise<Map<string, RouteGeometry>> {
  const data = await ensureTransitData();
  return data.geometries;
}

export async function getRealtimeLookups(): Promise<{
  geometries: Map<string, RouteGeometry>;
  tripToRoute: Map<string, string>;
}> {
  const data = await ensureTransitData();
  return { geometries: data.geometries, tripToRoute: data.tripToRoute };
}
