// backend/src/index.ts
import express from "express";
import cors from "cors";
import { setStatus } from "./status.js";
import { registerRoutes } from "./routes.js";
import { loadGtfs } from "./gtfsLoader.js";
import { loadRoutesFromGTFS } from "./dataStore.js";

// Export a shared holder for tripToRoute so your realtime layer can import it
export const tripToRouteGlobal: { map: Map<string, string> } = { map: new Map() };

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const { BODS_API_KEY, BODS_BBOX, GTFS_STATIC_URL, GTFS_STATIC_PATH } = process.env;
setStatus({
  realtimeEnabled: !!BODS_API_KEY && !!BODS_BBOX,
  lastFetchError:
    !BODS_API_KEY && !BODS_BBOX
      ? "Missing BODS_API_KEY and BODS_BBOX"
      : !BODS_API_KEY
      ? "Missing BODS_API_KEY"
      : !BODS_BBOX
      ? "Missing BODS_BBOX"
      : undefined,
});

// Optional: load GTFS routes + tripToRoute at startup
(async () => {
  try {
    const source = GTFS_STATIC_URL || GTFS_STATIC_PATH;
    if (source) {
      console.log(`[gtfs] loading from ${source} ...`);
      const { routes, tripToRoute } = await loadGtfs(source);
      loadRoutesFromGTFS(routes);
      tripToRouteGlobal.map = tripToRoute;
      console.log(`[gtfs] loaded ${routes.length} routes, ${tripToRoute.size} trip links`);
    } else {
      console.log("[gtfs] no GTFS source configured (set GTFS_STATIC_URL or GTFS_STATIC_PATH)");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[gtfs] load failed:", msg);
    setStatus({ lastFetchError: `GTFS load failed: ${msg}` });
  }
})();

registerRoutes(app);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`Backend listening on :${port}`);
});
