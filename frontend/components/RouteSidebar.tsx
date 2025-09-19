'use client';

import { useEffect, useMemo, useState } from 'react';
import { getRoutes, type Route } from '../lib/api';

function modeLabel(mode: Route['mode']) {
  return mode === 'bus' ? 'Bus' : 'Tram';
}

export default function RouteSidebar() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedMode, setSelectedMode] = useState<'all' | Route['mode']>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRoutes()
      .then((data) => {
        setRoutes(data);
        setError(null);
      })
      .catch((err) => {
        console.error(err);
        setError('Could not load routes');
      });
  }, []);

  const filteredRoutes = useMemo(() => {
    if (selectedMode === 'all') return routes;
    return routes.filter((route) => route.mode === selectedMode);
  }, [routes, selectedMode]);

  return (
    <aside className="h-full flex flex-col">
      <div className="p-4 border-b border-stone-200">
        <h1 className="text-lg font-semibold">TransitScope</h1>
        <p className="text-sm text-stone-500">Greater Manchester realtime explorer</p>
      </div>
      <div className="flex gap-2 p-4 border-b border-stone-200 text-sm">
        <button
          className={`rounded-full px-3 py-1 border ${selectedMode === 'all' ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 text-stone-600'}`}
          onClick={() => setSelectedMode('all')}
        >
          All modes
        </button>
        <button
          className={`rounded-full px-3 py-1 border ${selectedMode === 'bus' ? 'border-bus bg-bus text-white' : 'border-stone-200 text-stone-600'}`}
          onClick={() => setSelectedMode('bus')}
        >
          Buses
        </button>
        <button
          className={`rounded-full px-3 py-1 border ${selectedMode === 'tram' ? 'border-tram bg-tram text-stone-900' : 'border-stone-200 text-stone-600'}`}
          onClick={() => setSelectedMode('tram')}
        >
          Trams
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {error ? (
          <p className="p-4 text-sm text-red-600">{error}</p>
        ) : (
          <ul className="divide-y divide-stone-200">
            {filteredRoutes.map((route) => (
              <li key={route.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{route.name}</p>
                    <p className="text-xs uppercase tracking-wide text-stone-500">{modeLabel(route.mode)}</p>
                  </div>
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: route.color }}
                    aria-hidden
                  />
                </div>
              </li>
            ))}
            {filteredRoutes.length === 0 && !error ? (
              <li className="p-4 text-sm text-stone-500">No routes for this mode yet.</li>
            ) : null}
          </ul>
        )}
      </div>
      <div className="p-4 border-t border-stone-200 text-xs text-stone-500 space-y-1">
        <p>
          Uses open data from TfGM and the Bus Open Data Service. This demo replays a simulated feed so you can run
          everything offline.
        </p>
        <p>
          Backend URL: <code className="bg-stone-100 px-1 py-0.5 rounded">{process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000'}</code>
        </p>
      </div>
    </aside>
  );
}
