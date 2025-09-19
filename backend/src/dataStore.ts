// backend/src/dataStore.ts
import { setStatus } from "./status";

// If you already have central types, feel free to replace these with your imports.
export type Route = {
  id: string;
  shortName?: string;
  longName?: string;
  color?: string;        // hex without '#', or '#RRGGBB'
  mode?: "bus" | "tram" | "rail" | "ferry" | string;
  shape?: Array<[number, number]>; // [lon, lat] polyline (optional)
};

export type Stop = {
  id: string;
  name: string;
  lat: number;
  lon: number;
};

let routes: Route[] = []; // starts empty – NO SAMPLES
let stops: Stop[] = [];   // starts empty – NO SAMPLES

export function getRoutes(): Route[] {
  return routes;
}
export function getStops(): Stop[] {
  return stops;
}

// Call these from your GTFS/static loader once available.
export function loadRoutesFromGTFS(newRoutes: Route[]) {
  routes = Array.isArray(newRoutes) ? newRoutes : [];
  setStatus({ routesCount: routes.length, usingSamples: false });
}

export function loadStopsFromGTFS(newStops: Stop[]) {
  stops = Array.isArray(newStops) ? newStops : [];
  setStatus({ stopsCount: stops.length, usingSamples: false });
}

