// Replace your existing function with this version
async function downloadStaticFeed(staticUrl: string, apiKey: string): Promise<AdmZip> {
  const response = await fetch(new URL(staticUrl), {
    headers: { 'x-api-key': apiKey },
  });
  if (!response.ok) {
    throw new Error(`Failed to download GTFS feed: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return new AdmZip(Buffer.from(arrayBuffer));
}

// Replace your entire computeTransitData() with this version
async function computeTransitData(): Promise<TransitData> {
  const config = resolveBodsConfig();

  // If we're in "all operators" (bbox) mode, there may be no static GTFS URL.
  if (!config.staticUrl) {
    console.warn('No staticUrl provided — skipping static GTFS parse (all-operators mode).');
    return {
      routes: [],
      stops: [],
      geometries: new Map<string, RouteGeometry>(),
      tripToRoute: new Map<string, string>(),
    };
  }

  // --- WITH static feed: download & parse all GTFS files we need ---
  const zip = await downloadStaticFeed(config.staticUrl, config.apiKey);

  const rawRoutes = parseCsv<RawRouteRow>(zip, 'routes.txt');
  const rawTrips = parseCsv<RawTripRow>(zip, 'trips.txt');
  const rawStops = parseCsv<RawStopRow>(zip, 'stops.txt');
  const rawStopTimes = parseCsv<RawStopTimeRow>(zip, 'stop_times.txt');
  const rawShapes = parseCsv<RawShapeRow>(zip, 'shapes.txt');

  const stopTimesByTrip = new Map<string, RawStopTimeRow[]>();
  for (const row of rawStopTimes) {
    if (!stopTimesByTrip.has(row.trip_id)) {
      stopTimesByTrip.set(row.trip_id, []);
    }
    stopTimesByTrip.get(row.trip_id)!.push(row);
  }

  const shapesById = new Map<string, Array<{ sequence: number; coord: [number, number] }>>();
  for (const row of rawShapes) {
    const shapeId = row.shape_id;
    if (!shapeId) continue;
    const latitude = Number(row.shape_pt_lat);
    const longitude = Number(row.shape_pt_lon);
    const sequence = Number(row.shape_pt_sequence);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(sequence)) {
      continue;
    }
    if (!shapesById.has(shapeId)) {
      shapesById.set(shapeId, []);
    }
    shapesById.get(shapeId)!.push({ sequence, coord: [longitude, latitude] });
  }

  const stopsById = new Map<string, RawStopRow>();
  for (const row of rawStops) {
    stopsById.set(row.stop_id, row);
  }

  const tripsByRoute = new Map<string, RawTripRow[]>();
  const tripToRoute = new Map<string, string>();
  for (const trip of rawTrips) {
    tripToRoute.set(trip.trip_id, trip.route_id);
    if (!tripsByRoute.has(trip.route_id)) {
      tripsByRoute.set(trip.route_id, []);
    }
    tripsByRoute.get(trip.route_id)!.push(trip);
  }

  const routes: Route[] = [];
  const stops: Stop[] = [];
  const geometries = new Map<string, RouteGeometry>();

  for (const route of rawRoutes) {
    const routeTrips = tripsByRoute.get(route.route_id) ?? [];
    const representativeTrip = chooseRepresentativeTrip(route.route_id, routeTrips, stopTimesByTrip);
    const shape = buildRouteShape(representativeTrip?.shape_id, shapesById);
    const geometry = buildRouteGeometry(route.route_id, shape);
    geometries.set(route.route_id, geometry);

    routes.push({
      id: route.route_id,
      name: resolveRouteName(route),
      mode: resolveMode(route.route_type),
      color: normaliseColor(route.route_color),
      shape,
    });

    if (representativeTrip) {
      const routeStops = buildStopsForRoute(route.route_id, representativeTrip, stopTimesByTrip, stopsById);
      stops.push(...routeStops);
    }
  }

  return {
    routes,
    stops,
    geometries,
    tripToRoute,
  };
}
