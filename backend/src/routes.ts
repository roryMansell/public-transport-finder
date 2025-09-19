// backend/src/routes.ts
import type express from "express";
import { getRoutes, getStops } from "./dataStore.js";
import { getStatus } from "./status.js";

export function registerRoutes(app: express.Express) {
  // Simple health
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // Diagnostics for the frontend badge/overlay
  app.get("/api/status", (_req, res) => {
    res.json(getStatus());
  });

  // Real endpoints (may be empty arrays until you load GTFS)
  app.get("/api/routes", (_req, res) => {
    res.json(getRoutes());
  });

  app.get("/api/stops", (_req, res) => {
    res.json(getStops());
  });

  // If you previously had /api/routes/:routeId/stops using loadStopsForRoute,
  // you can add an equivalent using getStops() + filter by routeId once your
  // Stop type includes a route relationship.
}
