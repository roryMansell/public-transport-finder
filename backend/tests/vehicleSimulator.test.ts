import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
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

  afterEach(() => {
    vi.useRealTimers();
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

  it('refreshes vehicles using the provided fetcher when started', async () => {
    const nextVehicles: VehiclePosition[] = [
      {
        ...baseVehicles[0],
        id: 'vehicle-2',
        latitude: baseVehicles[0].latitude + 0.02,
        updatedAt: new Date(Date.now() + 2000).toISOString(),
      },
    ];
    const fetcher = vi.fn().mockResolvedValue(nextVehicles);
    const simulator = new VehicleSimulator(baseVehicles, fetcher);
    const listener = vi.fn();
    simulator.subscribe(listener);

    vi.useFakeTimers();
    simulator.start(1000);

    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(1);

    await fetcher.mock.results[0]!.value;
    await Promise.resolve();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1][0]).toEqual(nextVehicles);
  });
});
