const PRODUCTION_BASE = 'https://car-api.13982.com';

const currentEnv = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const runtimeEnv = (import.meta as any).env || {};
const configuredBaseUrl =
  runtimeEnv.VITE_API_BASE_URL ||
  runtimeEnv.UNI_API_BASE_URL ||
  process.env.VITE_API_BASE_URL ||
  process.env.UNI_API_BASE_URL ||
  '';

// Development: empty string for relative path / local proxy.
// Production: online domain as default, overridable via env var.
const ENV_BASE_URL: Record<string, string> = {
  development: '',
  production: PRODUCTION_BASE,
};

const envBaseUrl = configuredBaseUrl || ENV_BASE_URL[currentEnv] || PRODUCTION_BASE;

export const config = {
  BASE_URL: envBaseUrl,
};

export const BASE_URL = envBaseUrl;
