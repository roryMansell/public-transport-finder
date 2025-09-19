// backend/src/bodsConfig.ts
export type BodsConfig = {
  vehicleUrls: string[];
};

/**
 * Minimal resolver:
 * Prefer BODS_VEHICLE_URL (comma-separated GTFS-RT URLs).
 * If not provided, fall back to *empty* and the fetcher will complain usefully.
 */
export function resolveBodsConfig(): BodsConfig {
  const env = process.env.BODS_VEHICLE_URL || "";
  const vehicleUrls = env
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  return { vehicleUrls };
}
