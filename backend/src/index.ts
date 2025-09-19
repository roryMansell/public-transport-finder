import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { getRealtimeLookups, loadSampleVehicles } from './dataStore.js';
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

  let fetcher: (() => Promise<VehiclePosition[]>) | undefined;
  let initialVehicles: VehiclePosition[] = [];

  try {
    const config = resolveBodsConfig();
    const { geometries, tripToRoute } = await getRealtimeLookups();
    fetcher = () => fetchVehiclePositions(config, geometries, tripToRoute);
    initialVehicles = await fetcher();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Realtime vehicle feed unavailable (${message}). Using bundled sample data.`);
    initialVehicles = await loadSampleVehicles();
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
