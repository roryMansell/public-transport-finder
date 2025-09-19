import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VehicleSimulator } from '../src/vehicleSimulator.js';
import type { VehiclePosition } from '../src/types.js';

describe('VehicleSimulator', () => {
  let baseVehicles: VehiclePosition[];

  beforeEach(() => {
    baseVehicles = [
      {
        id: 'vehicle-1',
        routeId: 'bus-1',
        latitude: 53.48,
        longitude: -2.24,
        bearing: 90,
        speedKph: 30,
        updatedAt: new Date().toISOString(),
      },
    ];
  });

  it('provides initial snapshot to subscribers', () => {
    const simulator = new VehicleSimulator(baseVehicles);
    const listener = vi.fn();

    simulator.subscribe(listener);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(baseVehicles);
  });

  it('broadcasts when a new snapshot is loaded', () => {
    const simulator = new VehicleSimulator(baseVehicles);
    const listener = vi.fn();
    simulator.subscribe(listener);

    const nextVehicles: VehiclePosition[] = [
      {
        ...baseVehicles[0],
        latitude: baseVehicles[0].latitude + 0.01,
        updatedAt: new Date(Date.now() + 1000).toISOString(),
      },
    ];

    simulator.loadSnapshot(nextVehicles);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(nextVehicles);
  });
});
