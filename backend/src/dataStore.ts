// backend/src/dataStore.ts
import { setStatus } from "./status.js";

export type Route = {
  id: string;
  name?: string;
  shortName?: string;
  longName?: string;
  color?: string;
  mode?: "bus" | string;
  shape?: Array<[number, number]>;
};

export type Stop = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  routeId?: string;
};

let routes: Route[] = [];
let stops: Stop[] = [];

export function getRoutes(): Route[] {
  return routes;
}
export function getStops(): Stop[] {
  return stops;
}

// (kept for future GTFS support)
export function loadRoutesFromGTFS(newRoutes: Route[]) {
  routes = Array.isArray(newRoutes) ? newRoutes : [];
  setStatus({ routesCount: routes.length, usingSamples: false });
}
export function loadStopsFromGTFS(newStops: Stop[]) {
  stops = Array.isArray(newStops) ? newStops : [];
  setStatus({ stopsCount: stops.length, usingSamples: false });
}
