// backend/src/gtfsLoader.ts
import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';
import type { Route } from './dataStore.js';

export type GtfsLoaded = {
  routes: Route[];
  tripToRoute: Map<string, string>;
};

function parseCsv(buf: Buffer): any[] {
  return parse(buf.toString('utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

/**
 * Load GTFS from a zip file (URL or local path).
 * Only parses routes.txt and trips.txt.
 */
export async function loadGtfs(zipSource: string): Promise<GtfsLoaded> {
  let zip: AdmZip;

  if (/^https?:\/\//i.test(zipSource)) {
    const res = await fetch(zipSource);
    if (!res.ok) throw new Error(`GTFS download failed: ${res.status} ${res.statusText}`);
    const ab = await res.arrayBuffer();
    zip = new AdmZip(Buffer.from(ab));
  } else {
    zip = new AdmZip(zipSource);
  }

  const routesEntry = zip.getEntry('routes.txt');
  const tripsEntry = zip.getEntry('trips.txt');
  if (!routesEntry || !tripsEntry) {
    throw new Error('GTFS zip missing routes.txt or trips.txt');
  }

  const routesCsv = parseCsv(routesEntry.getData());
  const tripsCsv = parseCsv(tripsEntry.getData());

  const routes: Route[] = routesCsv.map((r: any) => ({
    id: r.route_id,
    shortName: r.route_short_name || undefined,
    longName: r.route_long_name || undefined,
    color: r.route_color ? (r.route_color.startsWith('#') ? r.route_color : `#${r.route_color}`) : undefined,
    mode: 'bus',
  }));

  const tripToRoute = new Map<string, string>();
  for (const t of tripsCsv) {
    if (t.trip_id && t.route_id) {
      tripToRoute.set(t.trip_id, t.route_id);
    }
  }

  return { routes, tripToRoute };
}
