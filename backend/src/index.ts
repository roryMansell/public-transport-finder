// backend/src/index.ts
import express from "express";
import cors from "cors";
import { setStatus } from "./status.js";
import { registerRoutes } from "./routes.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Mark we intend to run realtime (even though we do on-demand /api/snapshot)
setStatus({ realtimeEnabled: true });

registerRoutes(app);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`Backend listening on :${port}`);
});
