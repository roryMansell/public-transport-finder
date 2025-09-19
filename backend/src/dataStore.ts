import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Route, Stop, VehiclePosition } from './types.js';
import { buildRouteGeometry, type RouteGeometry } from './geometry.js';

interface TransitData {
  routes: Route[];
  stops: Stop[];
  geometries: Map<string, RouteGeometry>;
}

interface RawRoute {
  id: string;
  name: string;
  mode?: Route['mode'];
  color?: string;
  shape?: Array<[number, number]>;
}

interface RawStop {
  id: string;
  name: string;
  routeId: string;
  latitude: number;
  longitude: number;
}

interface RawVehicle extends VehiclePosition {}

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '../data');

async function readJsonFile<T>(filename: string): Promise<T> {
  const file = join(DATA_DIR, filename);
  const content = await readFile(file, 'utf8');
  return JSON.parse(content) as T;
}

let cachedTransitData: Promise<TransitData> | null = null;

async function computeTransitData(): Promise<TransitData> {
  const [rawRoutes, rawStops] = await Promise.all([
    readJsonFile<RawRoute[]>('sample_routes.json'),
    readJsonFile<RawStop[]>('sample_stops.json'),
  ]);

  const routes: Route[] = rawRoutes.map((route) => ({
    id: route.id,
    name: route.name,
    mode: route.mode ?? 'bus',
    color: route.color ?? '#005CAB',
    shape: route.shape ?? [],
  }));

  const routeIds = new Set(routes.map((route) => route.id));
  const geometries = new Map<string, RouteGeometry>();
  for (const route of routes) {
    geometries.set(route.id, buildRouteGeometry(route.id, route.shape));
  }

  const stops: Stop[] = rawStops
    .filter((stop) => routeIds.has(stop.routeId))
    .map((stop) => ({
      id: stop.id,
      name: stop.name,
      routeId: stop.routeId,
      latitude: stop.latitude,
      longitude: stop.longitude,
    }));

  return { routes, stops, geometries };
}

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
  return { geometries: data.geometries, tripToRoute: new Map() };
}

export async function loadSampleVehicles(): Promise<VehiclePosition[]> {
  const vehicles = await readJsonFile<RawVehicle[]>('sample_vehicles.json');
  return vehicles.map((vehicle) => ({
    ...vehicle,
    speedKph: Number.isFinite(vehicle.speedKph) ? vehicle.speedKph : 0,
  }));
}
