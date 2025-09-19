'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getSnapshot, type VehiclePosition } from '../lib/api';

const TILE_STYLE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

interface MarkerState {
  marker: Marker;
  vehicleId: string;
}

function resolveWebSocketUrl() {
  const explicit = process.env.NEXT_PUBLIC_WS_URL;
  if (explicit) {
    return explicit;
  }
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
  return apiBase.replace(/^http/, 'ws').replace(/\/?$/, '') + '/live';
}

function createMarker(vehicle: VehiclePosition) {
  const el = document.createElement('div');
  el.className = 'w-3 h-3 rounded-full border border-white shadow';
  el.style.backgroundColor = vehicle.routeId.startsWith('tram') ? '#FFCD00' : '#005CAB';
  el.setAttribute('title', `${vehicle.routeId} • ${Math.round(vehicle.speedKph)} km/h`);
  return new Marker({ element: el }).setLngLat([vehicle.longitude, vehicle.latitude]);
}

function updateMarker(marker: Marker, vehicle: VehiclePosition) {
  marker.setLngLat([vehicle.longitude, vehicle.latitude]);
  marker.getElement().setAttribute('title', `${vehicle.routeId} • ${Math.round(vehicle.speedKph)} km/h`);
}

export default function TransportMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, MarkerState>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

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
      center: [-2.244644, 53.483959],
      zoom: 11,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
    mapRef.current = map;

    const currentMarkers = markersRef.current;

    getSnapshot()
      .then((snapshot) => {
        snapshot.features.forEach((feature) => {
          const vehicle = feature.properties;
          const marker = createMarker(vehicle);
          currentMarkers.set(vehicle.id, { marker, vehicleId: vehicle.id });
          marker.addTo(map);
        });
        setError(null);
      })
      .catch((err) => {
        console.error(err);
        setError('Could not load vehicle positions');
      });

    const socket = new WebSocket(resolveWebSocketUrl());

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
              currentMarkers.set(vehicle.id, { marker, vehicleId: vehicle.id });
              marker.addTo(map);
            }
          });
        }
      } catch (error) {
        console.error('Failed to parse websocket payload', error);
      }
    });

    socket.addEventListener('error', () => {
      setError('Live updates unavailable. Showing last snapshot.');
    });

    return () => {
      socket.close();
      map.remove();
      mapRef.current = null;
      currentMarkers.forEach(({ marker }) => marker.remove());
      currentMarkers.clear();
    };
  }, []);

  return (
    <div className="relative h-full">
      <div ref={containerRef} className="absolute inset-0" />
      {error ? (
        <div className="absolute bottom-4 left-4 right-4 md:right-auto bg-white/80 backdrop-blur rounded shadow p-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}
    </div>
  );
}
