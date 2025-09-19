'use client';

import { useMemo } from 'react';
import type { Route } from '../lib/api';
import { API_BASE_URL } from '../lib/config';

function modeLabel(mode: Route['mode']) {
  return mode === 'bus' ? 'Bus' : 'Tram';
}

type ModeFilter = 'all' | Route['mode'];

interface RouteSidebarProps {
  routes: Route[];
  loading: boolean;
  error: string | null;
  selectedMode: ModeFilter;
  onModeChange: (mode: ModeFilter) => void;
  selectedRouteId: string | null;
  onRouteSelect: (routeId: string | null) => void;
}

export default function RouteSidebar({
  routes,
  loading,
  error,
  selectedMode,
  onModeChange,
  selectedRouteId,
  onRouteSelect,
}: RouteSidebarProps) {
  const filteredRoutes = useMemo(() => {
    if (selectedMode === 'all') return routes;
    return routes.filter((route) => route.mode === selectedMode);
  }, [routes, selectedMode]);

  const routeCountLabel = (() => {
    if (loading) return 'Loading routes…';
    if (error) return 'Unable to load routes';
    if (filteredRoutes.length === 0) return 'No routes available';
    return `${filteredRoutes.length} route${filteredRoutes.length === 1 ? '' : 's'}`;
  })();

  const handleRouteClick = (routeId: string) => {
    onRouteSelect(selectedRouteId === routeId ? null : routeId);
  };

  return (
    <aside className="h-full flex flex-col">
      <div className="p-4 border-b border-stone-200">
        <h1 className="text-lg font-semibold">TransitScope</h1>
        <p className="text-sm text-stone-500">Greater Manchester realtime explorer</p>
      </div>
      <div className="flex gap-2 p-4 border-b border-stone-200 text-sm">
        <button
          type="button"
          className={`rounded-full px-3 py-1 border transition-colors ${
            selectedMode === 'all'
              ? 'border-stone-900 bg-stone-900 text-white'
              : 'border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-800'
          }`}
          onClick={() => onModeChange('all')}
        >
          All modes
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1 border transition-colors ${
            selectedMode === 'bus'
              ? 'border-bus bg-bus text-white'
              : 'border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-800'
          }`}
          onClick={() => onModeChange('bus')}
        >
          Buses
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1 border transition-colors ${
            selectedMode === 'tram'
              ? 'border-tram bg-tram text-stone-900'
              : 'border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-800'
          }`}
          onClick={() => onModeChange('tram')}
        >
          Trams
        </button>
      </div>
      <div className="flex items-center justify-between px-4 py-2 border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
        <span>{routeCountLabel}</span>
        {selectedRouteId ? <span className="text-bus">Route focused</span> : null}
      </div>
      <div className="flex-1 overflow-y-auto">
        {error && !loading ? (
          <p className="p-4 text-sm text-red-600">{error}</p>
        ) : (
          <ul className="divide-y divide-stone-200">
            {filteredRoutes.map((route) => {
              const isSelected = selectedRouteId === route.id;
              return (
                <li key={route.id}>
                  <button
                    type="button"
                    onClick={() => handleRouteClick(route.id)}
                    className={`w-full text-left p-4 flex items-center justify-between gap-3 transition-colors ${
                      isSelected ? 'bg-stone-100/80' : 'hover:bg-stone-50'
                    }`}
                    aria-pressed={isSelected}
                  >
                    <div>
                      <p className="font-medium text-sm">{route.name}</p>
                      <p className="text-xs uppercase tracking-wide text-stone-500">{modeLabel(route.mode)}</p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs ${
                        isSelected ? 'border-stone-400 bg-white text-stone-700 shadow-sm' : 'border-stone-200 text-stone-600'
                      }`}
                    >
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: route.color }}
                        aria-hidden
                      />
                      <span>{route.id}</span>
                    </span>
                  </button>
                </li>
              );
            })}
            {!loading && filteredRoutes.length === 0 ? (
              <li className="p-4 text-sm text-stone-500">No routes for this mode yet.</li>
            ) : null}
          </ul>
        )}
      </div>
      <div className="p-4 border-t border-stone-200 text-xs text-stone-500 space-y-1">
        <p>Live vehicle positions and routes are loaded directly from the Bus Open Data Service.</p>
        <p>
          Backend URL: <code className="bg-stone-100 px-1 py-0.5 rounded">{API_BASE_URL}</code>
        </p>
        {selectedRouteId ? (
          <p className="text-stone-600">
            Showing vehicles, stops and route geometry for <strong>{selectedRouteId}</strong> on the map.
          </p>
        ) : (
          <p className="text-stone-600">Select a route to focus the map and highlight its live vehicles.</p>
        )}
      </div>
    </aside>
  );
}
