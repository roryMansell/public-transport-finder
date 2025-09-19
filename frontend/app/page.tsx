import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import RouteSidebar from '../components/RouteSidebar';

const TransportMap = dynamic(() => import('../components/TransportMap'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center text-stone-500">
      Loading map…
    </div>
  ),
});

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <div className="w-full md:w-80 bg-white border-b md:border-b-0 md:border-r border-stone-200">
        <RouteSidebar />
      </div>
      <div className="flex-1 relative min-h-[50vh]">
        <Suspense fallback={<div className="p-4">Loading map…</div>}>
          <TransportMap />
        </Suspense>
      </div>
    </main>
  );
}
