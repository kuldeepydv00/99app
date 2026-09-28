// API client for the new games. Same base URLs and login token as App.tsx's fetchApi.
const BASES = [
  typeof window !== 'undefined' ? (window.location.origin.includes('localhost') ? 'http://localhost:5002' : window.location.origin) : 'https://newmatkadomain.com',
  'https://newmatkadomain.com'
];

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem('99x_web_token');
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let lastErr: unknown = null;
  for (const base of BASES) {
    try {
      const res = await fetch(`${base}${path}`, { ...init, headers: { ...authHeaders(), ...(init.headers || {}) } });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) throw Object.assign(new Error('Please log in again to place bets.'), { final: true });
      if (!res.ok || data.success === false) throw Object.assign(new Error(data.message || `Request failed (${res.status})`), { final: true });
      return data as T;
    } catch (e: any) {
      if (e && e.final) throw e;
      lastErr = e; // network error: try next base
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Network error. Check your connection.');
}

export const gamesGet = <T = any>(path: string) => request<T>(path);
export const gamesPost = <T = any>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export type TradingGame = 'number' | 'card' | 'colour';
