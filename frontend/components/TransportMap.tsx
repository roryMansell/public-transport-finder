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
  selectedRouteId: string | null;
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
  if (EXPLICIT_WS_URL) {
    return EXPLICIT_WS_URL;
  }
  return API_BASE_URL.replace(/^http/, 'ws').replace(/\/?$/, '') + '/live';
}

function defaultColorForRoute(routeId: string) {
  return routeId.startsWith('tram') ? '#FFCD00' : '#005CAB';
}

function formatVehicleTitle(vehicle: VehiclePosition, route?: Route) {
  const speed = Number.isFinite(vehicle.speedKph) ? `${Math.round(vehicle.speedKph)} km/h` : 'Speed unavailable';
  return route ? `${route.name} • ${speed}` : `${vehicle.routeId} • ${speed}`;
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

  const routeLookup = useMemo(() => new Map(routes.map((route) => [route.id, route])), [routes]);
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

  const buildStopFeatures = (): FeatureCollection<Point, StopProperties> => {
    const stops = stopsRef.current;
    const features: Feature<Point, StopProperties>[] = stops
      .filter((stop) => {
        const route = routesByIdRef.current.get(stop.routeId);
        if (!route) return false;
        if (filtersRef.current.mode !== 'all' && route.mode !== filtersRef.current.mode) return false;
        return true;
      })
      .map((stop) => {
        const route = routesByIdRef.current.get(stop.routeId);
        const isSelected = Boolean(filtersRef.current.routeId && stop.routeId === filtersRef.current.routeId);
        const isDimmed = Boolean(filtersRef.current.routeId && stop.routeId !== filtersRef.current.routeId);
        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [stop.longitude, stop.latitude],
          },
          properties: {
            id: stop.id,
            name: stop.name,
            routeId: stop.routeId,
            color: route?.color ?? defaultColorForRoute(stop.routeId),
            selected: isSelected,
            dimmed: isDimmed,
          },
        };
      });

    return {
      type: 'FeatureCollection',
      features,
    };
  };

  const buildRouteLineFeatures = (): FeatureCollection<LineString, RouteLineProperties> => {
    const grouped = new Map<string, Stop[]>();
    for (const stop of stopsRef.current) {
      const route = routesByIdRef.current.get(stop.routeId);
      if (!route) continue;
      if (filtersRef.current.mode !== 'all' && route.mode !== filtersRef.current.mode) continue;
      if (!grouped.has(stop.routeId)) {
        grouped.set(stop.routeId, []);
      }
      grouped.get(stop.routeId)!.push(stop);
    }

    const features: Feature<LineString, RouteLineProperties>[] = [];
    for (const [routeId, stops] of grouped.entries()) {
      if (stops.length < 2) continue;
      const route = routesByIdRef.current.get(routeId);
      const coordinates = stops.map((stop) => [stop.longitude, stop.latitude] as [number, number]);
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates,
        },
        properties: {
          routeId,
          color: route?.color ?? defaultColorForRoute(routeId),
          selected: Boolean(filtersRef.current.routeId && routeId === filtersRef.current.routeId),
          name: route?.name ?? routeId,
        },
      });
    }

    return {
      type: 'FeatureCollection',
      features,
    };
  };

  const applyMarkerFilters = useCallback(() => {
    const { mode, routeId } = filtersRef.current;
    markersRef.current.forEach(({ marker, routeId: markerRouteId }) => {
      const route = routesByIdRef.current.get(markerRouteId);
      const element = marker.getElement();
      const matchesMode = mode === 'all' || route?.mode === mode;
      if (!matchesMode) {
        element.style.display = 'none';
        return;
      }
      element.style.display = 'block';
      element.style.backgroundColor = route?.color ?? defaultColorForRoute(markerRouteId);
      if (routeId && markerRouteId !== routeId) {
        element.style.opacity = '0.3';
        element.style.transform = 'scale(0.85)';
        element.style.zIndex = '10';
      } else {
        element.style.opacity = '1';
        element.style.transform = routeId ? 'scale(1.3)' : 'scale(1)';
        element.style.zIndex = routeId ? '30' : '10';
      }
    });
  }, []);

  const updateOverlays = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    const stopsSource = map.getSource('stops') as GeoJSONSource | undefined;
    if (stopsSource) {
      stopsSource.setData(buildStopFeatures());
    }
    const routesSource = map.getSource('route-lines') as GeoJSONSource | undefined;
    if (routesSource) {
      routesSource.setData(buildRouteLineFeatures());
    }
  }, []);

  const focusSelectedRoute = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    const { routeId } = filtersRef.current;
    if (!routeId) return;
    const coordinates: [number, number][] = [];
    const stops = stopsRef.current.filter((stop) => stop.routeId === routeId);
    if (stops.length > 0) {
      for (const stop of stops) {
        coordinates.push([stop.longitude, stop.latitude]);
      }
    } else {
      markersRef.current.forEach(({ marker, routeId: markerRouteId }) => {
        if (markerRouteId !== routeId) return;
        const lngLat = marker.getLngLat();
        coordinates.push([lngLat.lng, lngLat.lat]);
      });
    }
    if (coordinates.length === 0) {
      return;
    }
    const bounds = coordinates.slice(1).reduce(
      (acc, coord) => acc.extend(coord),
      new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
    );
    map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 700 });
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

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
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
          },
        ],
      },
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
    mapRef.current = map;

    const currentMarkers = markersRef.current;

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
        if (isMounted) {
          setVehicleError('Could not load vehicle positions');
        }
      });

    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(resolveWebSocketUrl());
    } catch (err) {
      console.error(err);
      if (isMounted) {
        setVehicleError('Realtime connection unavailable. Showing last snapshot.');
      }
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
        if (isMounted) {
          setVehicleError('Live updates unavailable. Showing last snapshot.');
        }
      });
      socket.addEventListener('close', () => {
        if (isMounted) {
          setVehicleError((prev) => prev ?? 'Live updates unavailable. Showing last snapshot.');
        }
      });
    }

    map.on('load', () => {
      mapLoadedRef.current = true;
      map.addSource('route-lines', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'route-lines',
        type: 'line',
        source: 'route-lines',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': [
            'case',
            ['boolean', ['get', 'selected'], false],
            5,
            3,
          ],
          'line-opacity': [
            'case',
            ['boolean', ['get', 'selected'], false],
            0.95,
            0.35,
          ],
        },
      });

      map.addSource('stops', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'stops-circles',
        type: 'circle',
        source: 'stops',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': [
            'case',
            ['boolean', ['get', 'selected'], false],
            6,
            ['boolean', ['get', 'dimmed'], false],
            3,
            4.5,
          ],
          'circle-opacity': [
            'case',
            ['boolean', ['get', 'selected'], false],
            0.95,
            ['boolean', ['get', 'dimmed'], false],
            0.3,
            0.7,
          ],
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
          'text-opacity': [
            'case',
            ['boolean', ['get', 'dimmed'], false],
            0.2,
            0.9,
          ],
        },
      });
      updateOverlays();
    });

    return () => {
      isMounted = false;
      mapLoadedRef.current = false;
      if (socket) {
        socket.close();
      }
      map.remove();
      mapRef.current = null;
      currentMarkers.forEach(({ marker }) => marker.remove());
      currentMarkers.clear();
    };
  }, [applyMarkerFilters, updateOverlays]);

  useEffect(() => {
    applyMarkerFilters();
    updateOverlays();
  }, [applyMarkerFilters, updateOverlays, routes, selectedMode, selectedRouteId]);

  useEffect(() => {
    if (!selectedRouteId) {
      if (mapRef.current && mapLoadedRef.current) {
        mapRef.current.easeTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 600 });
      }
      return;
    }
    focusSelectedRoute();
  }, [focusSelectedRoute, selectedRouteId]);

  useEffect(() => {
    let cancelled = false;

    async function loadStops() {
      try {
        const data = await getStops();
        if (cancelled) return;
        stopsRef.current = data;
        setStopsError(null);
        updateOverlays();
        if (filtersRef.current.routeId) {
          focusSelectedRoute();
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setStopsError('Could not load stops');
        }
      }
    }

    loadStops();

    return () => {
      cancelled = true;
    };
  }, [focusSelectedRoute, updateOverlays]);

  const messages = [vehicleError, stopsError].filter((message): message is string => Boolean(message));

  return (
    <div className="relative h-full">
      <div ref={containerRef} className="absolute inset-0" />
      {messages.length > 0 ? (
        <div className="absolute bottom-4 left-4 right-4 md:right-auto flex flex-col gap-2 text-sm">
          {messages.map((message, index) => (
            <div
              key={index}
              className="bg-white/90 backdrop-blur rounded border border-red-100 shadow text-red-700 px-3 py-2"
            >
              {message}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
