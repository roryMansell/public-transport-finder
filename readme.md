# TransitScope – Real-Time Public Transport Map (Free & Open Data Edition)

> 🚉 A completely free, open-source portfolio project that shows public transport vehicles in **real-time** (starting with Greater Manchester).  
> Uses **open data feeds** + **open-source mapping tools**. No paid APIs, no cloud costs. Runs locally or on free-tier hosts.

---

## ✨ Why this project?
- **Visually impressive** (live map of buses & trams).  
- **Tech stack breadth** (frontend, backend, data pipelines, realtime updates).  
- **Accessible** — 100% free: no AWS bills, no Mapbox, no paid APIs.  
- **Expandable** — start in GM, then scale to the UK.

---

## 🚍 Data Sources (All Free)
- **Buses (England):** [Bus Open Data Service (BODS)](https://data.bus-data.dft.gov.uk/)  
  - Provides timetables (GTFS) + realtime positions (GTFS-RT / SIRI-VM).  
- **Greater Manchester Metrolink (Trams):** [TfGM Open Data](https://developer.tfgm.com/)  
  - Stop and route data available openly.  
  - Realtime positions where available, or interpolate between stops.  
- **Trains (UK, optional):**  
  - [Network Rail Open Data](https://opendata.nationalrail.co.uk/) — free with registration.  
  - For a zero-signup version, stick to buses + trams.

---

## 🗺️ Maps
- **MapLibre GL JS** (open-source Mapbox GL alternative).  
- **OpenStreetMap tiles** from free community servers:  
  - `https://tile.openstreetmap.org/{z}/{x}/{y}.png`  
  - Or run your own with [Tileserver-GL](https://github.com/maptiler/tileserver-gl).  

---

## 🛠️ Tech Stack
**Frontend:**  
- Next.js (React, TypeScript)  
- MapLibre GL for maps  
- Tailwind CSS for styling  

**Backend (local-first):**  
- Node.js (Express / ws for WebSocket server)  
- Python (optional for ETAs + smoothing)  

**Data:**  
- SQLite (simple, embedded, free)  
- Optionally Postgres + PostGIS (Docker, free OSS)  

**Infra (free):**  
- Docker Compose for local orchestration  
- No AWS/GCP/Azure needed  

**Observability:**  
- Prometheus + Grafana (Docker, free)  

---

## 🧩 Architecture
```
Frontend (Next.js + MapLibre)
    |
    | WebSocket (live updates) / REST
    v
Backend (Node.js / Express)
    |
    | Ingest GTFS-RT / SIRI-VM feeds
    v
Local Database (SQLite / Postgres)
    |
    | ETA + smoothing logic (Python/Node)
    v
Broadcast positions back to frontend
```

---

## 🔮 Features

### MVP (Greater Manchester)
- Show **live bus & tram positions** on a map.  
- **Stop and route overlays** (from GTFS static data).  
- **WebSocket updates** every ~10s.  
- **Basic ETA estimates** from timetable + last seen location.  

### Future (still free)
- **Train positions** from Network Rail open data.  
- **Playback slider** to replay last hour.  
- **Delay heatmaps** from historical data.  
- **Crowding / disruption indicators**.  
- **PWA support** (offline map tiles, mobile-friendly).  

---

## 🏃 Getting Started (Local, Free)

### Prereqs
- Node.js (v20+)  
- Python (3.11+, optional for ETA logic)  
- Docker + Docker Compose  

### Setup
```bash
# Clone
git clone https://github.com/yourname/transitscope.git
cd transitscope

# Frontend
cd frontend
npm install
npm run dev   # http://localhost:3000

# Backend
cd ../backend
npm install
npm run dev   # runs WebSocket + REST API server

# (Optional) Start Postgres + Grafana stack
cd ../ops
docker-compose up
```

---

## 📂 Project Structure
```
/frontend/         # Next.js app (MapLibre GL)
/backend/          # Node.js API + WebSocket server
/services/         # Data ingestion & ETA scripts (Node/Python)
/data/             # Static GTFS data (BODS, TfGM)
/ops/              # Docker Compose (db, grafana)
/tests/            # Unit + integration tests
```

---

## 🔧 Realtime Logic
- **Bus/Tram feeds (GTFS-RT):** vehicle positions every 5–10s.  
- **Map matching:** snap GPS to nearest route polyline.  
- **Smoothing:** exponential moving average to reduce jitter.  
- **ETAs:**  
  - v1: scheduled timetable + linear interpolation.  
  - v2: add historical averages (from SQLite/Postgres).  

---

## 📡 Public API (free to run)
- `GET /api/routes` — list of routes  
- `GET /api/stops?route_id=...` — stops for a route  
- `GET /api/snapshot` — current vehicle positions (GeoJSON)  
- `WS /live` — subscribe for real-time updates  

---

## 📊 Observability
- **Prometheus** scrapes backend metrics (feed latency, update frequency).  
- **Grafana** dashboards (line health, update lag).  

---

## 🚀 Roadmap
1. Ingest TfGM tram + BODS bus GTFS data.  
2. Show realtime pins on a map with MapLibre.  
3. Add WebSocket updates.  
4. Add ETAs (simple).  
5. Add train positions (optional).  
6. Add historical playback + dashboards.  

---

## 📜 License
MIT — free to use, modify, and share.

---

Happy coding! 🚎🗺️

---

## ✅ Current Implementation Snapshot

This repository now ships with a working local-first stack that demonstrates the MVP experience described above. It uses
simulated vehicle movements so that everything runs without external credentials.

### Backend (`/backend`)
- Express REST API exposing `/api/routes`, `/api/stops`, `/api/snapshot`, and `/health`.
- WebSocket endpoint at `/live` that streams vehicle updates every five seconds.
- In-memory simulator that jitters sample vehicles and supports loading custom GeoJSON snapshots via `POST /admin/load`.
- Vitest unit tests covering the simulator broadcast behaviour.

### Frontend (`/frontend`)
- Next.js 14 (App Router) with a MapLibre GL map fed by the backend.
- Tailwind CSS styling with a responsive sidebar listing available routes.
- Live updates via WebSocket plus graceful fallbacks when realtime data is unavailable.

### Ops & Tooling
- Dockerfiles for both frontend and backend and a Docker Compose definition that wires them together.
- `/services` includes ingestion notes for BODS feeds and a small Python replay helper for offline development.

### Running locally
```bash
# Terminal 1 – backend
cd backend
npm install
npm run dev

# Terminal 2 – frontend
cd frontend
npm install
npm run dev
```
Visit http://localhost:3000 to see the realtime map.

To run the simulator tests:
```bash
cd backend
npm test
```

To lint the frontend:
```bash
cd frontend
npm run lint
```

---
