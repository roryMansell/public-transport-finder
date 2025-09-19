import type { Server } from 'node:http';
import { WebSocketServer } from 'ws';
import type { VehicleSimulator } from './vehicleSimulator.js';

export function createWebSocketServer(httpServer: Server, simulator: VehicleSimulator) {
  const wss = new WebSocketServer({ server: httpServer, path: '/live' });

  simulator.subscribe((vehicles) => {
    const payload = JSON.stringify({
      type: 'vehicle-update',
      vehicles,
    });
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) {
        client.send(payload);
      }
    }
  });

  wss.on('connection', (socket) => {
    socket.send(
      JSON.stringify({
        type: 'hello',
        message: 'Connected to TransitScope realtime feed',
      }),
    );
  });

  return wss;
}
