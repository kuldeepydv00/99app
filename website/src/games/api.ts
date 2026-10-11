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
      if (res.status === 401) {
        // Account deleted or login ended: App.tsx logs this device out
        if (data && (data.is_deleted || data.logout)) { try { window.dispatchEvent(new Event('99x-session-ended')); } catch { /* ignore */ } }
        throw Object.assign(new Error('Please log in again to place bets.'), { final: true });
      }
      if (!res.ok || data.success === false) throw Object.assign(new Error(data.message || `Request failed (${res.status})`), { final: true });
      return data as T;
    } catch (e: any) {
      if (e && e.final) throw e;
      lastErr = e; // network error: try next base
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Network error. Check your connection.');
}

/**
 * Runs `fn` every `ms` while the page is on screen, and once straight away when the player comes back
 * to it. Nothing is loaded while the tab or app is in the background. Returns the stop function.
 */
export function everyVisible(fn: () => void, ms: number): () => void {
  const id = window.setInterval(() => { if (document.visibilityState !== 'hidden') fn(); }, ms);
  const back = () => { if (document.visibilityState === 'visible') fn(); };
  document.addEventListener('visibilitychange', back);
  return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', back); };
}

/** Base URL for long-lived connections (live round stream); same first choice as requests. */
export const API_BASE = BASES[0];

export const gamesGet = <T = any>(path: string) => request<T>(path);
export const gamesPost = <T = any>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export type TradingGame = 'number' | 'card' | 'colour' | 'dragontiger' | 'toss';
