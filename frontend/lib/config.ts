const DEFAULT_API_BASE_URL = 'http://localhost:4000';

function readEnv(name: string) {
  const value = process.env[name];
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const API_BASE_URL = readEnv('NEXT_PUBLIC_API_BASE_URL') ?? DEFAULT_API_BASE_URL;
export const EXPLICIT_WS_URL = readEnv('NEXT_PUBLIC_WS_URL');

export { readEnv };
