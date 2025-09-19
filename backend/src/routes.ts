import type { Express, Request, Response } from 'express';
import { loadRoutes, loadStops, loadStopsForRoute } from './dataStore.js';
import { VehicleSimulator } from './vehicleSimulator.js';
import type { GeoJsonFeatureCollection, VehiclePosition } from './types.js';

function geoJsonToVehicles(snapshot: GeoJsonFeatureCollection): VehiclePosition[] {
  return snapshot.features.map((feature) => ({
    ...feature.properties,
    latitude: feature.geometry.coordinates[1],
    longitude: feature.geometry.coordinates[0],
  }));
}

export function registerRoutes(app: Express, simulator: VehicleSimulator) {
  app.get('/api/routes', async (_req: Request, res: Response) => {
    const routes = await loadRoutes();
    res.json(routes);
  });

  app.get('/api/stops', async (req: Request, res: Response) => {
    const routeId = req.query.routeId as string | undefined;
    if (routeId) {
      const stops = await loadStopsForRoute(routeId);
      res.json(stops);
      return;
    }
    const stops = await loadStops();
    res.json(stops);
  });

  app.get('/api/snapshot', (_req: Request, res: Response) => {
    const vehicles = simulator.getSnapshot();
    const payload: GeoJsonFeatureCollection = {
      type: 'FeatureCollection',
      features: vehicles.map((vehicle) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [vehicle.longitude, vehicle.latitude],
        },
        properties: vehicle,
      })),
    };
    res.json(payload);
  });

  app.post('/admin/load', (req: Request, res: Response) => {
    const body = req.body as GeoJsonFeatureCollection | undefined;
    if (!body || body.type !== 'FeatureCollection') {
      res.status(400).json({ error: 'Expected GeoJSON FeatureCollection' });
      return;
    }
    const vehicles = geoJsonToVehicles(body);
    simulator.loadSnapshot(vehicles);
    res.json({ status: 'ok', vehicles: vehicles.length });
  });
}
