/** API base URL — alleen uit Vite env, nooit secrets in de client */
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export function apiUrl(path: string): string {
  const base = API_BASE_URL.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}
