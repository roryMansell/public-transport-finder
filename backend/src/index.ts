import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { loadVehicles } from './dataStore.js';
import { VehicleSimulator } from './vehicleSimulator.js';
import { registerRoutes } from './routes.js';
import { createWebSocketServer } from './websocketServer.js';

const PORT = Number(process.env.PORT ?? 4000);

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const initialVehicles = await loadVehicles();
  const simulator = new VehicleSimulator(initialVehicles);
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
