// frontend/lib/config.ts

// If we’re running on GitHub Pages (or any https host) and no env provided,
// fall back to your public API; otherwise use localhost for dev.
const inferredProdApi =
  (typeof window !== 'undefined' && window.location.protocol === 'https:')
    ? 'https://your-api.example.com'
    : 'http://localhost:4000';

const apiFromEnv = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
const wsFromEnv  = process.env.NEXT_PUBLIC_WS_URL?.trim();

export const API_BASE_URL = apiFromEnv && apiFromEnv.length > 0 ? apiFromEnv : inferredProdApi;
export const EXPLICIT_WS_URL = wsFromEnv && wsFromEnv.length > 0 ? wsFromEnv : undefined;
