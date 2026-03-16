const DEFAULT_API_BASE = '/api/v1';

const normalizeApiBase = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_API_BASE;
  }

  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
};

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE ?? DEFAULT_API_BASE);

export const getApiUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
};
