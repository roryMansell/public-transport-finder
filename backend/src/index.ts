import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { getRealtimeLookups } from './dataStore.js';
import { VehicleSimulator } from './vehicleSimulator.js';
import { registerRoutes } from './routes.js';
import { createWebSocketServer } from './websocketServer.js';
import { resolveBodsConfig } from './bodsConfig.js';
import { fetchVehiclePositions } from './vehicleFetcher.js';
import type { VehiclePosition } from './types.js';

const PORT = Number(process.env.PORT ?? 4000);

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const config = resolveBodsConfig();
  const { geometries, tripToRoute } = await getRealtimeLookups();

  const fetcher = () => fetchVehiclePositions(config, geometries, tripToRoute);
  let initialVehicles: VehiclePosition[] = [];
  try {
    initialVehicles = await fetcher();
  } catch (error) {
    console.error('Failed to fetch initial vehicle positions', error);
  }

  const simulator = new VehicleSimulator(initialVehicles, fetcher);
  registerRoutes(app, simulator);

  const server = http.createServer(app);
  createWebSocketServer(server, simulator);
  simulator.start(5000);

  server.listen(PORT, () => {
    console.log(`TransitScope backend listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
