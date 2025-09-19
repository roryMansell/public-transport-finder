"use client";

import dynamic from 'next/dynamic';
import { Suspense, useEffect, useMemo, useState } from 'react';
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

function useModeAwareRouteSelection(routes: Route[]) {
  const [selectedMode, setSelectedMode] = useState<ModeFilter>('all');
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const handleModeChange = (mode: ModeFilter) => {
    setSelectedMode(mode);
    setSelectedRouteId((current) => {
      if (!current) return current;
      const route = routes.find((item) => item.id === current);
      if (!route) return null;
      if (mode === 'all' || route.mode === mode) {
        return current;
      }
      return null;
    });
  };

  const handleRouteSelect = (routeId: string | null) => {
    setSelectedRouteId(routeId);
    if (routeId) {
      const route = routes.find((item) => item.id === routeId);
      if (route && selectedMode !== 'all' && route.mode !== selectedMode) {
        setSelectedMode(route.mode);
      }
    }
  };

  return {
    selectedMode,
    selectedRouteId,
    setSelectedMode: handleModeChange,
    setSelectedRouteId: handleRouteSelect,
  };
}

export default function HomePage() {
  const { routes, loading, error } = useRoutes();
  const { selectedMode, selectedRouteId, setSelectedMode, setSelectedRouteId } = useModeAwareRouteSelection(routes);

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <div className="w-full md:w-80 bg-white border-b md:border-b-0 md:border-r border-stone-200">
        <RouteSidebar
          routes={routes}
          loading={loading}
          error={error}
          selectedMode={selectedMode}
          onModeChange={setSelectedMode}
          selectedRouteId={selectedRouteId}
          onRouteSelect={setSelectedRouteId}
        />
      </div>
      <div className="flex-1 relative min-h-[50vh]">
        <Suspense fallback={<div className="p-4">Loading map…</div>}>
          <TransportMap routes={routes} selectedMode={selectedMode} selectedRouteId={selectedRouteId} />
        </Suspense>
      </div>
    </main>
  );
}
