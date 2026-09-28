import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

// Same base as App.tsx. Requests to /api/admin/* get the admin token attached by
// the window.fetch patch installed in App.tsx.
export const API_BASE = import.meta.env.DEV ? 'http://localhost:5002' : 'https://newmatkadomain.com';

export async function apiGet<T = any>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.message || `Request failed (${res.status})`);
  return data as T;
}

export async function apiPost<T = any>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.message || `Request failed (${res.status})`);
  return data as T;
}

export const inr = (n: number | null | undefined) =>
  `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const istToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

export const istTime = (ms: number | string | null | undefined) => {
  if (!ms) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  }).format(new Date(ms));
};

export const istDateTime = (ms: number | string | null | undefined) => {
  if (!ms) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true
  }).format(new Date(ms));
};

export const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (x: number) => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
};

const SUIT: Record<string, { sym: string; red: boolean; name: string }> = {
  S: { sym: '♠', red: false, name: 'Spades' },
  H: { sym: '♥', red: true, name: 'Hearts' },
  D: { sym: '♦', red: true, name: 'Diamonds' },
  C: { sym: '♣', red: false, name: 'Clubs' }
};
export const SUIT_ORDER = ['S', 'H', 'D', 'C'];
export const suitInfo = (s: string) => SUIT[s];
export const cardParts = (code: string) => ({ rank: code.slice(0, -1), suit: code.slice(-1) });

export function CardLabel({ code }: { code: string | null | undefined }) {
  if (!code) return <span>—</span>;
  const { rank, suit } = cardParts(code);
  const info = SUIT[suit];
  return <span className={`font-bold ${info?.red ? 'text-red-600' : 'text-gray-900'}`}>{rank}{info?.sym}</span>;
}

const COLOUR_CLASS: Record<string, string> = { RED: 'bg-red-500', BLUE: 'bg-blue-500', GREEN: 'bg-emerald-500' };
export function ColourLabel({ value }: { value: string | null | undefined }) {
  if (!value) return <span>—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 font-bold">
      <span className={`w-3 h-3 rounded-full ${COLOUR_CLASS[value] || 'bg-gray-400'}`} />
      {value.charAt(0) + value.slice(1).toLowerCase()}
    </span>
  );
}

export function OptionLabel({ game, value }: { game: string; value: string | null | undefined }) {
  if (game === 'card') return <CardLabel code={value} />;
  if (game === 'colour') return <ColourLabel value={value} />;
  return <span className="font-mono font-bold">{value ?? '—'}</span>;
}

export function Pill({ tone, children }: { tone: 'green' | 'grey' | 'gold' | 'red' | 'blue'; children: ReactNode }) {
  const cls = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    grey: 'bg-gray-100 text-gray-600 border-gray-200',
    gold: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200'
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${cls}`}>
      {tone === 'green' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
      {children}
    </span>
  );
}

export function Kpi({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${accent ? 'border-blue-300 ring-1 ring-blue-100' : 'border-[#DEE2E6]'}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-extrabold text-gray-900 tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

export function Card({ title, right, children }: { title: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#DEE2E6] bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-bold text-gray-800">{title}</h2>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// Heat colour for a cell: white (0) to deep blue (the round's largest total).
export const heat = (value: number, max: number) => {
  if (!value || !max) return { backgroundColor: '#FFFFFF', color: '#6B7280' };
  const t = Math.min(1, value / max);
  const alpha = 0.12 + t * 0.78;
  return { backgroundColor: `rgba(0, 123, 255, ${alpha.toFixed(2)})`, color: t > 0.55 ? '#FFFFFF' : '#1F2937' };
};

// Re-runs `fn` every `ms` while mounted; returns a manual refresh.
export function usePolling(fn: () => Promise<void> | void, ms: number, deps: unknown[] = []) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let alive = true;
    const run = () => { if (alive) Promise.resolve(fnRef.current()).catch(() => {}); };
    run();
    const id = setInterval(run, ms);
    return () => { alive = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, ...deps]);
  return () => Promise.resolve(fnRef.current()).catch(() => {});
}

// Local clock kept in step with the server's clock.
export function useServerNow(serverTime: number | undefined) {
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (serverTime) setOffset(serverTime - Date.now()); }, [serverTime]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now + offset;
}
