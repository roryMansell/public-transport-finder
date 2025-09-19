import { VehiclePosition } from './types.js';

export type VehicleListener = (vehicles: VehiclePosition[]) => void;
export type VehicleFetcher = () => Promise<VehiclePosition[]>;

export class VehicleSimulator {
  private vehicles: VehiclePosition[];
  private listeners: Set<VehicleListener> = new Set();
  private timer?: ReturnType<typeof setInterval>;
  private refreshing = false;

  constructor(initialVehicles: VehiclePosition[], private readonly fetcher?: VehicleFetcher) {
    this.vehicles = initialVehicles;
  }

  public subscribe(listener: VehicleListener) {
    this.listeners.add(listener);
    listener(this.vehicles);
    return () => this.listeners.delete(listener);
  }

  public start(intervalMs = 10000) {
    if (this.timer) return;
    if (this.fetcher) {
      this.refresh().catch((error) => {
        console.error('Failed to load initial realtime snapshot', error);
      });
    }
    this.timer = setInterval(() => {
      if (!this.fetcher) return;
      this.refresh().catch((error) => {
        console.error('Failed to refresh realtime vehicles', error);
      });
    }, intervalMs);
  }

  public stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  public getSnapshot(): VehiclePosition[] {
    return this.vehicles;
  }

  public loadSnapshot(vehicles: VehiclePosition[]) {
    this.vehicles = vehicles;
    this.broadcast();
  }

  private async refresh() {
    if (!this.fetcher) return;
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      const next = await this.fetcher();
      this.vehicles = next;
      this.broadcast();
    } finally {
      this.refreshing = false;
    }
  }

  private broadcast() {
    for (const listener of this.listeners) {
      listener(this.vehicles);
    }
  }
}

