// frontend/components/StatusBadge.tsx
import * as React from "react";
import { BackendStatus } from "../lib/useBackendStatus";

export function StatusBadge({ status }: { status?: BackendStatus }) {
  if (!status) return null;

  const hasError = !!status.lastFetchError || !status.realtimeEnabled;
  const isDegraded =
    !hasError && (status.vehiclesCount === 0 || status.routesCount === 0);

  const label = hasError ? "Error" : isDegraded ? "Degraded" : "OK";
  const title =
    status.lastFetchError ??
    (isDegraded
      ? `No ${status.routesCount === 0 ? "routes" : "vehicles"}`
      : "All systems normal");

  const dot =
    hasError ? "bg-red-500" : isDegraded ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="fixed top-3 right-3 z-50 flex items-center gap-2 rounded-2xl bg-black/80 px-3 py-1 text-white shadow-lg backdrop-blur">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs opacity-80">
        {title}
        {status.lastFetchAt
          ? ` • ${new Date(status.lastFetchAt).toLocaleTimeString()}`
          : ""}
      </span>
    </div>
  );
}
