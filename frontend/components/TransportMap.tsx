'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { GeoJSONSource, Map as MapLibreMap, Marker } from 'maplibre-gl';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { getSnapshot, getStops, type Route, type Stop, type VehiclePosition } from '../lib/api';
import { API_BASE_URL, EXPLICIT_WS_URL } from '../lib/config';

const TILE_STYLE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const DEFAULT_CENTER: [number, number] = [-2.244644, 53.483959];
const DEFAULT_ZOOM = 11;

interface MarkerState {
  marker: Marker;
  vehicleId: string;
  routeId: string;
}

interface TransportMapProps {
  routes: Route[];
  selectedMode: 'all' | Route['mode'];
  selectedRouteId: string | null; // the route the user clicked in the sidebar
}

interface StopProperties {
  id: string;
  name: string;
  routeId: string;
  color: string;
  selected: boolean;
  dimmed: boolean;
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

function formatVehicleTitle(vehicle: VehiclePosition, route?: Route) {
  const titleParts: string[] = [];
  titleParts.push(route ? route.name : vehicle.routeId);
  if (Number.isFinite(vehicle.speedKph)) titleParts.push(`${Math.round(vehicle.speedKph)} km/h`);
  else titleParts.push('Speed unavailable');
  if (typeof vehicle.progress === 'number' && Number.isFinite(vehicle.progress)) {
    titleParts.push(`${Math.round(vehicle.progress * 100)}% along route`);
  }
  return titleParts.join(' • ');
}

export default function TransportMap({ routes, selectedMode, selectedRouteId }: TransportMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapLoadedRef = useRef(false);
  const markersRef = useRef<Map<string, MarkerState>>(new Map());
  const stopsRef = useRef<Stop[]>([]);
  const routesByIdRef = useRef<Map<string, Route>>(new Map());
  const filtersRef = useRef({ mode: selectedMode, routeId: selectedRouteId });
  const [vehicleError, setVehicleError] = useState<string | null>(null);
  const [stopsError, setStopsError] = useState<string | null>(null);

  const routeLookup = useMemo(() => new Map(routes.map((r) => [r.id, r])), [routes]);
  routesByIdRef.current = routeLookup;
  filtersRef.current = { mode: selectedMode, routeId: selectedRouteId };

  const createMarker = (vehicle: VehiclePosition) => {
    const route = routesByIdRef.current.get(vehicle.routeId);
    const el = document.createElement('button');
    el.type = 'button';
    el.className =
      'group w-3 h-3 rounded-full border border-white shadow transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500';
    el.style.backgroundColor = route?.color ?? defaultColorForRoute(vehicle.routeId);
    el.dataset.routeId = vehicle.routeId;
    el.dataset.mode = route?.mode ?? 'bus';
    const title = formatVehicleTitle(vehicle, route);
    el.setAttribute('title', title);
    el.setAttribute('aria-label', title);
    return new Marker({ element: el }).setLngLat([vehicle.longitude, vehicle.latitude]);
  };

  const updateMarker = (marker: Marker, vehicle: VehiclePosition) => {
    const route = routesByIdRef.current.get(vehicle.routeId);
    const title = formatVehicleTitle(vehicle, route);
    marker.setLngLat([vehicle.longitude, vehicle.latitude]);
    marker.getElement().setAttribute('title', title);
    marker.getElement().setAttribute('aria-label', title);
  };

  // Only build stop features for the selected route (or none if not selected)
  const buildStopFeatures = (): FeatureCollection<Point, StopProperties> => {
    const sel = filtersRef.current.routeId;
    if (!sel) {
      return { type: 'FeatureCollection', features: [] };
    }
    const stops = stopsRef.current.filter((s) => s.routeId === sel);
    const route = routesByIdRef.current.get(sel);
    const features: Feature<Point, StopProperties>[] = stops.map((stop) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [stop.longitude, stop.latitude] },
      properties: {
        id: stop.id,
        name: stop.name,
        routeId: stop.routeId,
        color: route?.color ?? defaultColorForRoute(stop.routeId),
        selected: true,
        dimmed: false,
      },
    }));
    return { type: 'FeatureCollection', features };
  };

  // Only draw the selected route’s polyline
  const buildRouteLineFeatures = (): FeatureCollection<LineString, RouteLineProperties> => {
    const sel = filtersRef.current.routeId;
    if (!sel) {
      return { type: 'FeatureCollection', features: [] };
    }
    const route = routesByIdRef.current.get(sel);
    if (!route || !route.shape || route.shape.length < 2) {
      return { type: 'FeatureCollection', features: [] };
    }
    const feature: Feature<LineString, RouteLineProperties> = {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: route.shape },
      properties: {
        routeId: sel,
        color: route.color ?? defaultColorForRoute(sel),
        selected: true,
        name: route.name,
      },
    };
    return { type: 'FeatureCollection', features: [feature] };
  };

  const applyMarkerFilters = useCallback(() => {
    const { mode, routeId } = filtersRef.current;
    markersRef.current.forEach(({ marker, routeId: markerRouteId }) => {
      const route = routesByIdRef.current.get(markerRouteId);
      const el = marker.getElement();
      const matchesMode = mode === 'all' || route?.mode === mode;
      if (!matchesMode) {
        el.style.display = 'none';
        return;
      }
      el.style.display = 'block';
      el.style.backgroundColor = route?.color ?? defaultColorForRoute(markerRouteId);
      if (routeId && markerRouteId !== routeId) {
        el.style.opacity = '0.35';
        el.style.transform = 'scale(0.85)';
        el.style.zIndex = '10';
      } else {
        el.style.opacity = '1';
        el.style.transform = routeId ? 'scale(1.25)' : 'scale(1)';
        el.style.zIndex = routeId ? '30' : '10';
      }
    });
  }, []);

  const updateOverlays = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    const stopsSource = map.getSource('stops') as GeoJSONSource | undefined;
    if (stopsSource) stopsSource.setData(buildStopFeatures());
    const routesSource = map.getSource('route-lines') as GeoJSONSource | undefined;
    if (routesSource) routesSource.setData(buildRouteLineFeatures());
  }, []);

  const focusSelectedRoute = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    const routeId = filtersRef.current.routeId;
    if (!routeId) return;

    const route = routesByIdRef.current.get(routeId);
    const coords: [number, number][] = [];
    if (route?.shape && route.shape.length > 0) {
      coords.push(...route.shape);
    } else {
      const stops = stopsRef.current.filter((s) => s.routeId === routeId);
      for (const s of stops) coords.push([s.longitude, s.latitude]);
    }

    if (coords.length === 0) return;

    const bounds = coords.slice(1).reduce(
      (acc, c) => acc.extend(c),
      new maplibregl.LngLatBounds(coords[0], coords[0]),
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
          osm: {
            type: 'raster',
            tiles: [TILE_STYLE],
            tileSize: 256,
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
    mapRef.current = map;

    const currentMarkers = markersRef.current;
    let resizeObserver: ResizeObserver | null = null;

    if (containerRef.current && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(containerRef.current);
    }

    // Initial snapshot of vehicles
    getSnapshot()
      .then((snapshot) => {
        if (!isMounted) return;
        snapshot.features.forEach((feature) => {
          const vehicle = feature.properties;
          const marker = createMarker(vehicle);
          currentMarkers.set(vehicle.id, { marker, vehicleId: vehicle.id, routeId: vehicle.routeId });
          marker.addTo(map);
        });
        applyMarkerFilters();
        setVehicleError(null);
      })
      .catch((err) => {
        console.error(err);
        if (isMounted) setVehicleError('Could not load vehicle positions');
      });

    // Live updates via WS
    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(resolveWebSocketUrl());
    } catch (err) {
      console.error(err);
      if (isMounted) setVehicleError('Realtime connection unavailable. Showing last snapshot.');
    }

    if (socket) {
      socket.addEventListener('message', (event) => {
        try {
          const payload = JSON.parse(event.data) as { type: string; vehicles?: VehiclePosition[] };
          if (payload.type === 'vehicle-update' && payload.vehicles) {
            payload.vehicles.forEach((vehicle) => {
              const existing = currentMarkers.get(vehicle.id);
              if (existing) {
                updateMarker(existing.marker, vehicle);
              } else {
                const marker = createMarker(vehicle);
                currentMarkers.set(vehicle.id, { marker, vehicleId: vehicle.id, routeId: vehicle.routeId });
                marker.addTo(map);
              }
            });
            applyMarkerFilters();
          }
        } catch (error) {
          console.error('Failed to parse websocket payload', error);
        }
      });

      socket.addEventListener('error', () => {
        if (isMounted) setVehicleError('Live updates unavailable. Showing last snapshot.');
      });
      socket.addEventListener('close', () => {
        if (isMounted) setVehicleError((prev) => prev ?? 'Live updates unavailable. Showing last snapshot.');
      });
    }

    map.on('load', () => {
      map.resize();
      mapLoadedRef.current = true;

      map.addSource('route-lines', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'route-lines',
        type: 'line',
        source: 'route-lines',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['case', ['boolean', ['get', 'selected'], false], 5, 3],
          'line-opacity': ['case', ['boolean', ['get', 'selected'], false], 0.95, 0.35],
        },
      });

      map.addSource('stops', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'stops-circles',
        type: 'circle',
        source: 'stops',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 6, 4.5],
          'circle-opacity': ['case', ['boolean', ['get', 'selected'], false], 0.95, 0.7],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1,
        },
      });
      map.addLayer({
        id: 'stops-labels',
        type: 'symbol',
        source: 'stops',
        minzoom: 13,
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-offset': [0, 1],
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#1f2937',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1,
          'text-opacity': 0.9,
        },
      });

      updateOverlays();
    });

    return () => {
      isMounted = false;
      mapLoadedRef.current = false;
      if (socket) socket.close();
      map.remove();
      mapRef.current = null;
      currentMarkers.forEach(({ marker }) => marker.remove());
      currentMarkers.clear();
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [applyMarkerFilters, updateOverlays]);

  // Re-apply filters & overlays whenever selection or routes change
  useEffect(() => {
    applyMarkerFilters();
    updateOverlays();
  }, [applyMarkerFilters, updateOverlays, routes, selectedMode, selectedRouteId]);

  // When a route becomes selected, zoom to it; when cleared, reset view
  useEffect(() => {
    if (!selectedRouteId) {
      if (mapRef.current && mapLoadedRef.current) {
        mapRef.current.easeTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 600 });
      }
      return;
    }
    focusSelectedRoute();
  }, [focusSelectedRoute, selectedRouteId]);

  // Load stops once (used when a route is selected)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getStops();
        if (cancelled) return;
        stopsRef.current = data;
        setStopsError(null);
        updateOverlays();
        if (filtersRef.current.routeId) focusSelectedRoute();
      } catch (err) {
        console.error(err);
        if (!cancelled) setStopsError('Could not load stops');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [focusSelectedRoute, updateOverlays]);

  const messages = [vehicleError, stopsError].filter((m): m is string => Boolean(m));

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
