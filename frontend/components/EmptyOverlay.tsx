// frontend/components/EmptyOverlay.tsx
import * as React from "react";
import { BackendStatus } from "@/lib/useBackendStatus";

export default function EmptyOverlay({ status }: { status?: BackendStatus }) {
  if (!status) return null;

  const reasons: string[] = [];
  if (status.lastFetchError)
    reasons.push(`Backend error: ${status.lastFetchError}`);
  if (status.routesCount === 0)
    reasons.push("No routes available (GTFS/static routes not loaded).");
  if (status.realtimeEnabled && status.vehiclesCount === 0)
    reasons.push("No vehicles returned from realtime feed.");

  if (reasons.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-14 z-40 mx-auto w-[min(720px,92%)] rounded-2xl bg-white/90 p-4 text-gray-900 shadow-xl backdrop-blur">
      <div className="pointer-events-auto">
        <div className="mb-2 font-semibold">Nothing to display</div>
        <ul className="list-disc pl-5 text-sm">
          {reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        <div className="mt-2 text-xs text-gray-600">
          Check env: <code>BODS_API_KEY</code>, <code>BODS_BBOX</code>, and
          ensure GTFS routes are loaded on the backend.
        </div>
      </div>
    </div>
  );
}
