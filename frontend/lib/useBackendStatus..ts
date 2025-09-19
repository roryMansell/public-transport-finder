// frontend/lib/useBackendStatus.ts
import { useEffect, useState } from "react";

export type BackendStatus = {
  realtimeEnabled: boolean;
  lastFetchAt?: string;
  lastFetchError?: string;
  vehiclesCount: number;
  routesCount: number;
  stopsCount: number;
  usingSamples: boolean;
};

export function useBackendStatus() {
  const [status, setStatus] = useState<BackendStatus | undefined>(undefined);
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

  useEffect(() => {
    let cancelled = false;

    async function pull() {
      try {
        const r = await fetch(`${base}/api/status`, { cache: "no-store" });
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        const j = (await r.json()) as BackendStatus;
        if (!cancelled) setStatus(j);
      } catch (e) {
        if (!cancelled)
          setStatus({
            realtimeEnabled: false,
            lastFetchError: e instanceof Error ? e.message : String(e),
            vehiclesCount: 0,
            routesCount: 0,
            stopsCount: 0,
            usingSamples: false,
          });
      }
    }
    pull();
    const id = setInterval(pull, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [base]);

  return status;
}
