// frontend/lib/config.ts

const DEFAULT_API_BASE_URL = 'http://localhost:4000';

// ✅ Direct references (no dynamic indexing)
const apiFromEnv = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
const wsFromEnv  = process.env.NEXT_PUBLIC_WS_URL?.trim();

export const API_BASE_URL =
  apiFromEnv && apiFromEnv.length > 0 ? apiFromEnv : DEFAULT_API_BASE_URL;

export const EXPLICIT_WS_URL =
  wsFromEnv && wsFromEnv.length > 0 ? wsFromEnv : undefined;

// If nothing else uses readEnv, you can delete it and stop exporting it.
