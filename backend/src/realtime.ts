// backend/src/realtime.ts
import { fetchVehiclePositions } from "./vehicleFetcher.js";
import type { BodsConfig } from "./bodsConfig.js";
import type { RouteGeometry } from "./geometry.js";
import { setStatus } from "./status.js";

export function startRealtimePoller(
  config: BodsConfig,
  geometries: Map<string, RouteGeometry>,
  tripToRoute: Map<string, string>,
  publish: (vehicles: any[]) => void // your simulator.publish
) {
  console.log(`[realtime] configured vehicle feeds: ${config.vehicleUrls.length}`);
  config.vehicleUrls.forEach((u, i) => console.log(`  [${i}] ${u}`));

  const tick = async () => {
    try {
      const vehicles = await fetchVehiclePositions(config, geometries, tripToRoute);
      publish(vehicles);
    } catch (e) {
      setStatus({ lastFetchError: e instanceof Error ? e.message : String(e) });
      console.error("[realtime] tick error:", e);
    }
  };

  tick(); // initial
  setInterval(tick, 5000);
}
