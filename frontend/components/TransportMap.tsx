'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { getSnapshot, getStops, type Route, type Stop, type VehiclePosition } from '../lib/api';
import { API_BASE_URL, EXPLICIT_WS_URL } from '../lib/config';

const TILE_STYLE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const DEFAULT_CENTER: [number, number] = [-2.244644, 53.483959];
const DEFAULT_ZOOM = 11;

interface TransportMapProps {
  routes: Route[];
  selectedMode: 'all' | Route['mode'];
  selectedRouteId: string | null;
}

interface StopProperties {
  id: string;
  name: string;
  routeId: string;
  color: string;
  selected: boolean;
}

interface RouteLineProperties {
  routeId: string;
  color: string;
  selected: boolean;
  name: string;
}

function resolveWebSocketUrl() {
  if (EXPLICIT_WS_URL) return EXPLICIT_WS_URL;
  return API_BASE_URL.replace(/^http/, 'ws').replace(/\/?$/, '') + '/live';
}

function defaultColorForRoute(routeId: string) {
  return routeId.startsWith('tram') ? '#FFCD00' : '#005CAB';
}

export default function TransportMap({ routes, selectedMode, selectedRouteId }: TransportMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapLoadedRef = useRef(false);
  const stopsRef = useRef<Stop[]>([]);
  const routesByIdRef = useRef<Map<string, Route>>(new Map());
  const filtersRef = useRef({ mode: selectedMode, routeId: selectedRouteId });
  const [vehicleError, setVehicleError] = useState<string | null>(null);
  const [stopsError, setStopsError] = useState<string | null>(null);

  const routeLookup = useMemo(() => new Map(routes.map((r) => [r.id, r])), [routes]);
  routesByIdRef.current = routeLookup;
  filtersRef.current = { mode: selectedMode, routeId: selectedRouteId };

  // --- GeoJSON builders ---

  const buildVehicleFC = useCallback(
    (vehicles: VehiclePosition[]): FeatureCollection<Point> => {
      // mode filter (optional)
      const filtered = vehicles.filter((v) => {
        if (filtersRef.current.mode === 'all') return true;
        const r = routesByIdRef.current.get(v.routeId);
        return r?.mode === filtersRef.current.mode;
      });
      return {
        type: 'FeatureCollection',
        features: filtered.map((v) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [v.longitude, v.latitude] },
          properties: {
            id: v.id,
            routeId: v.routeId,
            speedKph: Number.isFinite(v.speedKph) ? Math.round(v.speedKph!) : null,
            color: routesByIdRef.current.get(v.routeId)?.color ?? defaultColorForRoute(v.routeId),
            selected: filtersRef.current.routeId ? v.routeId === filtersRef.current.routeId : false,
            dimmed: filtersRef.current.routeId ? v.routeId !== filtersRef.current.routeId : false,
          },
        })),
      };
    },
    []
  );

  const buildStopFeatures = useCallback((): FeatureCollection<Point, StopProperties> => {
    const sel = filtersRef.current.routeId;
    if (!sel) return { type: 'FeatureCollection', features: [] };
    const route = routesByIdRef.current.get(sel);
    const features: Feature<Point, StopProperties>[] = stopsRef.current
      .filter((s) => s.routeId === sel)
      .map((s) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.longitude, s.latitude] },
        properties: {
          id: s.id,
          name: s.name,
          routeId: s.routeId,
          color: route?.color ?? defaultColorForRoute(s.routeId),
          selected: true,
        },
      }));
    return { type: 'FeatureCollection', features };
  }, []);

  const buildRouteLineFeatures = useCallback((): FeatureCollection<LineString, RouteLineProperties> => {
    const sel = filtersRef.current.routeId;
    if (!sel) return { type: 'FeatureCollection', features: [] };
    const route = routesByIdRef.current.get(sel);
    if (!route?.shape || route.shape.length < 2) return { type: 'FeatureCollection', features: [] };
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: route.shape },
          properties: {
            routeId: sel,
            color: route.color ?? defaultColorForRoute(sel),
            selected: true,
            name: route.name,
          },
        },
      ],
    };
  }, []);

  // --- Update sources ---

  const updateStopsAndRouteLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    (map.getSource('stops') as GeoJSONSource | undefined)?.setData(buildStopFeatures());
    (map.getSource('route-lines') as GeoJSONSource | undefined)?.setData(buildRouteLineFeatures());
  }, [buildStopFeatures, buildRouteLineFeatures]);

  const focusSelectedRoute = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    const sel = filtersRef.current.routeId;
    if (!sel) return;
    const route = routesByIdRef.current.get(sel);
    const coords: [number, number][] = route?.shape ?? [];
    if (coords.length === 0) return;
    const bounds = coords.slice(1).reduce(
      (acc, c) => acc.extend(c),
      new maplibregl.LngLatBounds(coords[0], coords[0])
    );
    map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 700 });
  }, []);

  // --- Map init ---

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let isMounted = true;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: { type: 'raster', tiles: [TILE_STYLE], tileSize: 256, attribution: '© OpenStreetMap contributors' },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
    mapRef.current = map;

    map.on('load', async () => {
      if (!isMounted) return;
      map.resize();
      mapLoadedRef.current = true;

      // Vehicle source (clustered for perf)
      map.addSource('vehicles', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterRadius: 35,
        clusterMaxZoom: 14,
      });

      // Cluster circles
      map.addLayer({
        id: 'vehicle-clusters',
        type: 'circle',
        source: 'vehicles',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#2563eb',
          'circle-radius': ['step', ['get', 'point_count'], 10, 50, 14, 150, 18],
          'circle-opacity': 0.75,
        },
      });

      // Cluster count labels
      map.addLayer({
        id: 'vehicle-cluster-count',
        type: 'symbol',
        source: 'vehicles',
        filter: ['has', 'point_count'],
        layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 12 },
        paint: { 'text-color': '#ffffff' },
      });

      // Individual vehicles
      map.addLayer({
        id: 'vehicle-points',
        type: 'circle',
        source: 'vehicles',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': [
            'case',
            ['boolean', ['get', 'selected'], false],
            4.5,
            ['boolean', ['get', 'dimmed'], false],
            2.5,
            3.5,
          ],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1,
          'circle-opacity': [
            'case',
            ['boolean', ['get', 'dimmed'], false],
            0.35,
            0.9,
          ],
        },
      });

      // Route + stops (only for selected route)
      map.addSource('route-lines', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'route-lines',
        type: 'line',
        source: 'route-lines',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 5, 'line-opacity': 0.95 },
      });

      map.addSource('stops', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'stops-circles',
        type: 'circle',
        source: 'stops',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 5,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1,
        },
      });

      // Initial vehicles
      try {
        const snapshot = await getSnapshot();
        if (!isMounted) return;
        (map.getSource('vehicles') as GeoJSONSource).setData(buildVehicleFC(snapshot.features.map(f => f.properties)));
        setVehicleError(null);
      } catch (e) {
        console.error(e);
        if (isMounted) setVehicleError('Could not load vehicle positions');
      }

      // Load stops once (for selected route)
      try {
        const data = await getStops();
        if (!isMounted) return;
        stopsRef.current = data;
        setStopsError(null);
        updateStopsAndRouteLayers();
      } catch (e) {
        console.error(e);
        if (isMounted) setStopsError('Could not load stops');
      }

      // WebSocket updates (throttled)
      let last = 0;
      const THROTTLE_MS = 500; // raise if still heavy
      let socket: WebSocket | null = null;
      try {
        socket = new WebSocket(resolveWebSocketUrl());
        socket.onmessage = (ev) => {
          const now = Date.now();
          if (now - last < THROTTLE_MS) return;
          last = now;
          try {
            const payload = JSON.parse(ev.data) as { type: string; vehicles?: VehiclePosition[] };
            if (payload.type === 'vehicle-update' && payload.vehicles) {
              (map.getSource('vehicles') as GeoJSONSource).setData(buildVehicleFC(payload.vehicles));
            }
          } catch (e) {
            console.error('WS parse', e);
          }
        };
        socket.onerror = () => setVehicleError('Live updates unavailable. Showing last snapshot.');
        socket.onclose = () =>
          setVehicleError((prev) => prev ?? 'Live updates unavailable. Showing last snapshot.');
      } catch (e) {
        console.error(e);
        setVehicleError('Realtime connection unavailable. Showing last snapshot.');
      }
    });

    return () => {
      mapLoadedRef.current = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [buildVehicleFC, updateStopsAndRouteLayers]);

  // React to selection/mode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    // Rebuild vehicles source based on current mode selection using last known data
    // (We don’t keep a cache; next WS update will fully refresh. This just repaints stops/route.)
    updateStopsAndRouteLayers();

    if (!selectedRouteId) {
      map.easeTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 600 });
    } else {
      focusSelectedRoute();
    }
  }, [selectedMode, selectedRouteId, updateStopsAndRouteLayers, focusSelectedRoute]);

  const messages = [vehicleError, stopsError].filter(Boolean) as string[];

  return (
    <div className="relative h-full">
      <div ref={containerRef} className="absolute inset-0" />
      {messages.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 md:right-auto flex flex-col gap-2 text-sm">
          {messages.map((m, i) => (
            <div key={i} className="bg-white/90 backdrop-blur rounded border border-red-100 shadow text-red-700 px-3 py-2">
              {m}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
