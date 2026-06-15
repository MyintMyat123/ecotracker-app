export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
export const TOKEN_STORAGE_KEY = 'ecotracker_auth_token';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'user' | 'admin';
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

export interface AppNotification {
  id: number;
  user_id: number;
  type: 'watchlist_add' | 'watchlist_update' | 'status_change' | 'new_sighting' | 'system';
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: 'user' | 'admin';
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  watchlists_count?: number;
}

export interface AdminStats {
  stats: {
    total_users: number;
    active_users: number;
    admin_users: number;
    total_watchlist: number;
    recent_users: number;
  };
  top_species: Array<{
    gbif_species_key: number;
    scientific_name: string;
    common_name: string | null;
    conservation_status_label: string | null;
    watch_count: number;
  }>;
  status_dist: Array<{
    conservation_status_label: string;
    count: number;
  }>;
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
