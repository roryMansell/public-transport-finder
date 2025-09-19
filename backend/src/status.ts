// backend/src/status.ts
export type FeedDiag = {
  url: string;
  ok?: boolean;
  httpStatus?: number;
  statusText?: string;
  bytes?: number;
  entities?: number;      // decoded GTFS-RT entities
  error?: string;
  at?: string;            // ISO timestamp of this probe
};

export type BackendStatus = {
  realtimeEnabled: boolean;
  lastFetchAt?: string;
  lastFetchError?: string;
  vehiclesCount: number;
  routesCount: number;
  stopsCount: number;
  usingSamples: boolean;
  feeds?: FeedDiag[];     // 👈 NEW: per-feed info
};

let status: BackendStatus = {
  realtimeEnabled: false,
  vehiclesCount: 0,
  routesCount: 0,
  stopsCount: 0,
  usingSamples: false,
  feeds: [],
};

export const getStatus = (): BackendStatus => status;

export const setStatus = (partial: Partial<BackendStatus>) => {
  status = { ...status, ...partial };
};
