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
  selectedRouteIds: string[];
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

export default function TransportMap({ routes, selectedMode, selectedRouteIds }: TransportMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapLoadedRef = useRef(false);
  const stopsRef = useRef<Stop[]>([]);
  const vehiclesRef = useRef<VehiclePosition[]>([]);
  const routesByIdRef = useRef<Map<string, Route>>(new Map());
  const filtersRef = useRef({ mode: selectedMode, routeIds: selectedRouteIds });
  const [vehicleError, setVehicleError] = useState<string | null>(null);
  const [stopsError, setStopsError] = useState<string | null>(null);

  const routeLookup = useMemo(() => new Map(routes.map((r) => [r.id, r])), [routes]);
  routesByIdRef.current = routeLookup;
  filtersRef.current = { mode: selectedMode, routeIds: selectedRouteIds };

  const buildVehicleFC = useCallback(
    (vehicles: VehiclePosition[]): FeatureCollection<Point> => {
      const selection = new Set(filtersRef.current.routeIds);
      const modeFilter = filtersRef.current.mode;

      // ✅ Realtime-only: if no routes are loaded at all, show ALL vehicles
      if (routesByIdRef.current.size === 0) {
        return {
          type: 'FeatureCollection',
          features: vehicles.map((vehicle) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [vehicle.longitude, vehicle.latitude] },
            properties: {
              id: vehicle.id,
              routeId: vehicle.routeId,
              speedKph: Number.isFinite(vehicle.speedKph) ? Math.round(vehicle.speedKph!) : null,
              color: defaultColorForRoute(vehicle.routeId),
              selected: true,
              dimmed: false,
            },
          })),
        };
      }

      // With routes loaded: keep existing selection behavior
      if (selection.size === 0) {
        return { type: 'FeatureCollection', features: [] };
      }

      const filtered = vehicles.filter((vehicle) => {
        if (!selection.has(vehicle.routeId)) return false;
        if (modeFilter === 'all') return true;
        const route = routesByIdRef.current.get(vehicle.routeId);
        return route?.mode === modeFilter;
      });

      return {
        type: 'FeatureCollection',
        features: filtered.map((vehicle) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [vehicle.longitude, vehicle.latitude] },
          properties: {
            id: vehicle.id,
            routeId: vehicle.routeId,
            speedKph: Number.isFinite(vehicle.speedKph) ? Math.round(vehicle.speedKph!) : null,
            color: routesByIdRef.current.get(vehicle.routeId)?.color ?? defaultColorForRoute(vehicle.routeId),
            selected: true,
            dimmed: false,
          },
        })),
      };
    },
    [],
  );

  const buildStopFeatures = useCallback((): FeatureCollection<Point, StopProperties> => {
    const selection = new Set(filtersRef.current.routeIds);
    if (selection.size === 0) {
      return { type: 'FeatureCollection', features: [] };
    }
    const features: Feature<Point, StopProperties>[] = [];
    for (const stop of stopsRef.current) {
      if (!selection.has(stop.routeId)) continue;
      const route = routesByIdRef.current.get(stop.routeId);
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [stop.longitude, stop.latitude] },
        properties: {
          id: stop.id,
          name: stop.name,
          routeId: stop.routeId,
          color: route?.color ?? defaultColorForRoute(stop.routeId),
          selected: true,
        },
      });
    }
    return { type: 'FeatureCollection', features };
  }, []);

  const buildRouteLineFeatures = useCallback((): FeatureCollection<LineString, RouteLineProperties> => {
    const selection = new Set(filtersRef.current.routeIds);
    if (selection.size === 0) {
      return { type: 'FeatureCollection', features: [] };
    }
    const features: Feature<LineString, RouteLineProperties>[] = [];
    for (const routeId of selection) {
      const route = routesByIdRef.current.get(routeId);
      if (!route?.shape || route.shape.length < 2) continue;
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: route.shape },
        properties: {
          routeId,
          color: route.color ?? defaultColorForRoute(routeId),
          selected: true,
          name: route.name,
        },
      });
    }
    return { type: 'FeatureCollection', features };
  }, []);

  const updateVehicleLayer = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    const source = map.getSource('vehicles') as GeoJSONSource | undefined;
    source?.setData(buildVehicleFC(vehiclesRef.current));
  }, [buildVehicleFC]);

  const updateStopsAndRouteLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    (map.getSource('stops') as GeoJSONSource | undefined)?.setData(buildStopFeatures());
    (map.getSource('route-lines') as GeoJSONSource | undefined)?.setData(buildRouteLineFeatures());
  }, [buildStopFeatures, buildRouteLineFeatures]);

  const focusSelectedRoutes = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    const selection = filtersRef.current.routeIds;
    if (selection.length === 0) return;

    const coordinates: Array<[number, number]> = [];
    for (const routeId of selection) {
      const route = routesByIdRef.current.get(routeId);
      if (route?.shape && route.shape.length > 0) {
        coordinates.push(...route.shape);
        continue;
        }
      const stops = stopsRef.current.filter((stop) => stop.routeId === routeId);
      coordinates.push(...stops.map((stop) => [stop.longitude, stop.latitude] as [number, number]));
    }

    if (coordinates.length === 0) return;

    const bounds = coordinates.slice(1).reduce(
      (acc, coord) => acc.extend(coord),
      new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
    );

    map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 700 });
  }, []);

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

      map.addSource('vehicles', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterRadius: 35,
        clusterMaxZoom: 14,
      });

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

      map.addLayer({
        id: 'vehicle-cluster-count',
        type: 'symbol',
        source: 'vehicles',
        filter: ['has', 'point_count'],
        layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 12 },
        paint: { 'text-color': '#ffffff' },
      });

      map.addLayer({
        id: 'vehicle-points',
        type: 'circle',
        source: 'vehicles',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 4,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1,
          'circle-opacity': 0.9,
        },
      });

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

      try {
        const snapshot = await getSnapshot();
        if (!isMounted) return;
        const vehicles = snapshot.features.map((feature) => feature.properties as VehiclePosition);
        vehiclesRef.current = vehicles;
        (map.getSource('vehicles') as GeoJSONSource).setData(buildVehicleFC(vehicles));
        setVehicleError(null);
      } catch (error) {
        console.error(error);
        if (isMounted) setVehicleError('Could not load vehicle positions');
      }

      try {
        const data = await getStops();
        if (!isMounted) return;
        stopsRef.current = data;
        setStopsError(null);
        updateStopsAndRouteLayers();
      } catch (error) {
        console.error(error);
        if (isMounted) setStopsError('Could not load stops');
      }

      let last = 0;
      const THROTTLE_MS = 500;
      let socket: WebSocket | null = null;
      try {
        socket = new WebSocket(resolveWebSocketUrl());
        socket.onmessage = (event) => {
          const now = Date.now();
          if (now - last < THROTTLE_MS) return;
          last = now;
          try {
            const payload = JSON.parse(event.data) as { type: string; vehicles?: VehiclePosition[] };
            if (payload.type === 'vehicle-update' && payload.vehicles) {
              vehiclesRef.current = payload.vehicles;
              (map.getSource('vehicles') as GeoJSONSource).setData(buildVehicleFC(payload.vehicles));
            }
          } catch (err) {
            console.error('WS parse', err);
          }
        };
        socket.onerror = () => setVehicleError('Live updates unavailable. Showing last snapshot.');
        socket.onclose = () => setVehicleError((prev) => prev ?? 'Live updates unavailable. Showing last snapshot.');
      } catch (err) {
        console.error(err);
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    updateVehicleLayer();
    updateStopsAndRouteLayers();

    if (selectedRouteIds.length === 0) {
      map.easeTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 600 });
    } else {
      focusSelectedRoutes();
    }
  }, [selectedMode, selectedRouteIds, updateVehicleLayer, updateStopsAndRouteLayers, focusSelectedRoutes]);

  const messages = [vehicleError, stopsError].filter(Boolean) as string[];
  const hasSelection = selectedRouteIds.length > 0;

  return (
    <div className="relative h-full">
      <div ref={containerRef} className="absolute inset-0" />
      {/* ✅ Only show the selection overlay if routes actually exist */}
      {routesByIdRef.current.size > 0 && !hasSelection ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white/90 backdrop-blur rounded border border-stone-200 px-4 py-3 text-sm text-stone-700 shadow">
            Select one or more routes to display live buses.
          </div>
        </div>
      ) : null}
      {messages.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 md:right-auto flex flex-col gap-2 text-sm">
          {messages.map((message, index) => (
            <div key={index} className="bg-white/90 backdrop-blur rounded border border-red-100 shadow text-red-700 px-3 py-2">
              {message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
