// backend/src/routes.ts
import type express from "express";
import { getRoutes, getStops } from "./dataStore.js";
import { getStatus } from "./status.js";
import { resolveBodsConfig } from "./bodsConfig.js";
import { fetchVehiclePositions } from "./vehicleFetcher.js";

export function registerRoutes(app: express.Express) {
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.get("/api/status", (_req, res) => res.json(getStatus()));

  app.get("/api/routes", (_req, res) => res.json(getRoutes()));

  app.get("/api/stops", (_req, res) => res.json(getStops()));

  // One-shot realtime snapshot (GeoJSON FeatureCollection)
  app.get("/api/snapshot", async (_req, res) => {
    try {
      const config = resolveBodsConfig();
      const vehicles = await fetchVehiclePositions(config, new Map(), new Map());

      res.json({
        type: "FeatureCollection",
        features: vehicles.map(v => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [v.longitude, v.latitude] },
          properties: v,
        })),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(502).json({ error: msg });
    }
  });
}
