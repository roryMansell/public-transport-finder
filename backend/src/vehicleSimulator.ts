// ❌ remove this:
// import { setInterval } from 'node:timers';
import { VehiclePosition } from './types.js';

export type VehicleListener = (vehicles: VehiclePosition[]) => void;

export class VehicleSimulator {
  private vehicles: VehiclePosition[];
  private listeners: Set<VehicleListener> = new Set();

  // ✅ use a safe type for Node/browser typings
  private timer?: ReturnType<typeof setInterval>;

  constructor(initialVehicles: VehiclePosition[]) {
    this.vehicles = initialVehicles;
  }

  public subscribe(listener: VehicleListener) {
    this.listeners.add(listener);
    listener(this.vehicles);
    return () => this.listeners.delete(listener);
  }

  public start(intervalMs = 10000) {
    if (this.timer) return;

    // ✅ use the global setInterval (no import)
    this.timer = setInterval(() => {
      this.tick();
      this.broadcast();
    }, intervalMs);
  }

  public stop() {
    if (!this.timer) return;
    clearInterval(this.timer);   // ✅ matches the ReturnType<typeof setInterval>
    this.timer = undefined;
  }

  public getSnapshot(): VehiclePosition[] {
    return this.vehicles;
  }

  public loadSnapshot(vehicles: VehiclePosition[]) {
    this.vehicles = vehicles;
    this.broadcast();
  }

  private tick() {
    const now = new Date().toISOString();
    this.vehicles = this.vehicles.map((vehicle) => {
      const deltaLat = (Math.random() - 0.5) * 0.002;
      const deltaLng = (Math.random() - 0.5) * 0.002;
      const speedKph = Math.max(10, Math.min(50, vehicle.speedKph + (Math.random() - 0.5) * 5));
      let bearing = vehicle.bearing + (Math.random() - 0.5) * 20;
      if (bearing < 0) bearing += 360;
      if (bearing >= 360) bearing -= 360;
      return {
        ...vehicle,
        latitude: vehicle.latitude + deltaLat,
        longitude: vehicle.longitude + deltaLng,
        bearing,
        speedKph,
        updatedAt: now,
      };
    });
  }

  private broadcast() {
    for (const listener of this.listeners) {
      listener(this.vehicles);
    }
  }
}

