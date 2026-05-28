export const API_BASE_URL = 'http://localhost:8000/api';
export const TOKEN_STORAGE_KEY = 'ecotracker_auth_token';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
}

export interface WatchlistItem {
  id: number;
  user_id: number;
  gbif_species_key: number;
  common_name: string | null;
  scientific_name: string;
  conservation_status: string | null;
  conservation_status_label: string | null;
  family: string | null;
  kingdom: string | null;
  image_url: string | null;
  last_observed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WatchlistPayload {
  gbif_species_key: number;
  common_name?: string | null;
  scientific_name: string;
  conservation_status?: string | null;
  conservation_status_label?: string | null;
  family?: string | null;
  kingdom?: string | null;
  image_url?: string | null;
  last_observed_at?: string | null;
}

interface RequestOptions extends RequestInit {
  token?: string | null;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers, ...requestOptions } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message || Object.values(data?.errors || {}).flat().join(' ') || 'Request failed.';
    throw new Error(message);
  }

  return data as T;
}
