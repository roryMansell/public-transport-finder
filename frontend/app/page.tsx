"use client";

import dynamic from 'next/dynamic';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import RouteSidebar from '../components/RouteSidebar';
import { getRoutes, type Route } from '../lib/api';

type ModeFilter = 'all' | Route['mode'];

const TransportMap = dynamic(() => import('../components/TransportMap'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center text-stone-500">
      Loading map…
    </div>
  ),
});

function useRoutes() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await getRoutes();
        if (!cancelled) {
          setRoutes(data);
          setError(null);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError('Could not load routes');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(
    () => ({
      routes,
      loading,
      error,
    }),
    [routes, loading, error],
  );
}

export default function HomePage() {
  const { routes, loading, error } = useRoutes();
  const [selectedMode, setSelectedMode] = useState<ModeFilter>('bus');
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedRouteIds((current) => current.filter((id) => routes.some((route) => route.id === id)));
  }, [routes]);

  const handleModeChange = useCallback(
    (mode: ModeFilter) => {
      setSelectedMode(mode);
      if (mode === 'all') return;
      const allowed = new Set(routes.filter((route) => route.mode === mode).map((route) => route.id));
      setSelectedRouteIds((current) => current.filter((id) => allowed.has(id)));
    },
    [routes],
  );

  const handleRouteToggle = useCallback(
    (routeId: string) => {
      const route = routes.find((item) => item.id === routeId);
      if (!route) return;
      const isSelected = selectedRouteIds.includes(routeId);
      setSelectedRouteIds((current) => {
        if (current.includes(routeId)) {
          return current.filter((id) => id !== routeId);
        }
        return [...current, routeId];
      });
      if (!isSelected && selectedMode !== 'all' && route.mode !== selectedMode) {
        handleModeChange(route.mode);
      }
    },
    [routes, selectedMode, selectedRouteIds, handleModeChange],
  );

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <div className="w-full md:w-80 bg-white border-b md:border-b-0 md:border-r border-stone-200">
        <RouteSidebar
          routes={routes}
          loading={loading}
          error={error}
          selectedMode={selectedMode}
          onModeChange={handleModeChange}
          selectedRouteIds={selectedRouteIds}
          onRouteToggle={handleRouteToggle}
        />
      </div>
      <div className="flex-1 relative min-h-[50vh]">
        <Suspense fallback={<div className="p-4">Loading map…</div>}>
          <TransportMap routes={routes} selectedMode={selectedMode} selectedRouteIds={selectedRouteIds} />
        </Suspense>
      </div>
    </main>
  );
}
