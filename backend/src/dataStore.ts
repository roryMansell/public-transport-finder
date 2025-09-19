import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Route, Stop, VehiclePosition } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveDataPath(fileName: string) {
  return path.join(__dirname, '..', 'data', fileName);
}

export async function loadRoutes(): Promise<Route[]> {
  const buffer = await readFile(resolveDataPath('sample_routes.json'), 'utf-8');
  return JSON.parse(buffer) as Route[];
}

export async function loadStops(): Promise<Stop[]> {
  const buffer = await readFile(resolveDataPath('sample_stops.json'), 'utf-8');
  return JSON.parse(buffer) as Stop[];
}

export async function loadVehicles(): Promise<VehiclePosition[]> {
  const buffer = await readFile(resolveDataPath('sample_vehicles.json'), 'utf-8');
  return JSON.parse(buffer) as VehiclePosition[];
}
