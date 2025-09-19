// backend/src/status.ts
export type BackendStatus = {
  realtimeEnabled: boolean;
  lastFetchAt?: string;       // ISO timestamp of last successful realtime fetch
  lastFetchError?: string;    // last fetch error message (stringified)
  vehiclesCount: number;      // number of vehicles in the last snapshot
  routesCount: number;        // number of routes currently loaded
  stopsCount: number;         // number of stops currently loaded
  usingSamples: boolean;      // always false now (we're removing samples)
};

let status: BackendStatus = {
  realtimeEnabled: false,
  vehiclesCount: 0,
  routesCount: 0,
  stopsCount: 0,
  usingSamples: false,
};

export const getStatus = (): BackendStatus => status;

export const setStatus = (partial: Partial<BackendStatus>) => {
  status = { ...status, ...partial };
};
