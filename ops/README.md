# Ops

`docker-compose.yml` wires up the frontend and backend using the free MapLibre + open data stack. Build images with:

```bash
cd ops
docker compose up --build
```

The compose file keeps everything local and free-to-run. If you later add Postgres or monitoring services they can live in
this directory.
