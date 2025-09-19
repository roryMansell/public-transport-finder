// backend/src/index.ts
import express from "express";
import cors from "cors";
import morgan from "morgan";

import { getRoutes, getStops } from "./dataStore";
import { getStatus, setStatus } from "./status";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

// --- Health & Status ---
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/api/status", (_req, res) => res.json(getStatus()));

// --- Data Endpoints (now reflect reality — may be empty) ---
app.get("/api/routes", (_req, res) => {
  res.json(getRoutes()); // []
});

app.get("/api/stops", (_req, res) => {
  res.json(getStops()); // []
});

// If you have a vehicles snapshot endpoint already, keep it as-is.
// Otherwise you might have WS-only live updates.

// --- Startup wiring & diagnostics ---
const port = Number(process.env.PORT || 4000);
const { BODS_API_KEY, BODS_BBOX } = process.env;

const realtimeEnabled = !!BODS_API_KEY && !!BODS_BBOX;
setStatus({ realtimeEnabled, usingSamples: false });

if (!realtimeEnabled) {
  const err =
    !BODS_API_KEY && !BODS_BBOX
      ? "Missing BODS_API_KEY and BODS_BBOX"
      : !BODS_API_KEY
      ? "Missing BODS_API_KEY"
      : "Missing BODS_BBOX";
  setStatus({ lastFetchError: err });
  console.warn("[backend] Realtime disabled:", err);
} else {
  console.log("[backend] Realtime configured.");
  // OPTIONAL: If you have a realtime loop, hook its success/error to the status:
  // Example: in your fetch interval success handler call:
  //   setStatus({ lastFetchAt: new Date().toISOString(), vehiclesCount: vehicles.length, lastFetchError: undefined });
  // and in error handler call:
  //   setStatus({ lastFetchError: err instanceof Error ? err.message : String(err) });
}

app.listen(port, () => {
  console.log(`Backend listening on :${port}`);
});
