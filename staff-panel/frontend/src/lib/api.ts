/** API base — publieke URL alleen; nooit secrets in de client */
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? '/api/v1';

export type StaffUser = {
  id: string;
  username: string;
  permissions: string[];
};

export type HealthStatus = {
  status: string;
  service: string;
  timestamp: string;
};

export type PlayerItem = {
  id: string;
  username: string;
  uuid: string | null;
};

export type PlayersResponse = {
  items: PlayerItem[];
  query: string;
};

export type ReportItem = {
  id: string;
  player: string;
  reason: string;
  status: string;
  createdAt: string;
};

export type ReportsResponse = {
  items: ReportItem[];
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export function apiUrl(path: string): string {
  const base = API_BASE_URL.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as {
      message?: string | string[];
    };
    if (Array.isArray(data.message)) return data.message.join(', ');
    if (typeof data.message === 'string') return data.message;
  } catch {
    /* ignore */
  }
  return res.statusText || 'Onbekende fout';
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new ApiError(res.status, await parseError(res));
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export function fetchMe(): Promise<StaffUser> {
  return apiFetch<StaffUser>('/auth/me');
}

export function fetchHealth(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>('/health');
}

export function fetchPlayers(q: string): Promise<PlayersResponse> {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  const qs = params.toString();
  return apiFetch<PlayersResponse>(`/players${qs ? `?${qs}` : ''}`);
}

export function fetchReports(): Promise<ReportsResponse> {
  return apiFetch<ReportsResponse>('/reports');
}

export function login(
  username: string,
  password: string,
): Promise<{ ok: boolean; user: StaffUser }> {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function logout(): Promise<{ ok: boolean }> {
  return apiFetch('/auth/logout', { method: 'POST' });
}
