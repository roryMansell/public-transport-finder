// backend/src/index.ts
import express from "express";
import cors from "cors";
import { getStatus, setStatus } from "./status.js";
import { registerRoutes } from "./routes.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// mark realtime config presence (purely informational)
const { BODS_API_KEY, BODS_BBOX } = process.env;
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

// mount API routes
registerRoutes(app);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`Backend listening on :${port}`);
});
