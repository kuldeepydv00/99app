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

// ---------- shared admin helpers for the new-game pages ----------

export type OpenUser = (mobile: string) => void;

// Downloads rows as a CSV file (Excel opens it). First row = headers.
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + rows.map(r => r.map(esc).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function BetStatus({ status }: { status: string }) {
  if (status === 'won') return <Pill tone="gold">Won</Pill>;
  if (status === 'lost') return <Pill tone="grey">Lost</Pill>;
  if (status === 'refunded') return <Pill tone="red">Refunded</Pill>;
  return <Pill tone="blue">Pending</Pill>;
}

// Player name + mobile; clicking opens the user's details page when onOpenUser is given.
export function PlayerCell({ name, mobile, onOpenUser }: { name?: string; mobile: string; onOpenUser?: OpenUser }) {
  if (!onOpenUser) return <span><span className="font-semibold">{name || 'Player'}</span> <span className="font-mono text-gray-500">{mobile}</span></span>;
  return (
    <button onClick={() => onOpenUser(mobile)} title="Open user details" className="text-left hover:underline">
      <span className="font-semibold text-[#007BFF]">{name || 'Player'}</span> <span className="font-mono text-gray-500">{mobile}</span>
    </button>
  );
}

// Modal used for every money-moving admin action (undo, refund, cancel, pause).
export function ConfirmDialog({ title, children, confirmLabel, tone = 'blue', askReason = false, onConfirm, onClose }: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: 'blue' | 'red' | 'green';
  askReason?: boolean;
  onConfirm: (reason: string) => Promise<ReactNode | void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<ReactNode>(null);
  const btn = { blue: 'bg-[#007BFF] hover:bg-[#0069D9]', red: 'bg-[#DC3545] hover:bg-[#C82333]', green: 'bg-[#28A745] hover:bg-[#218838]' }[tone];
  const run = async () => {
    setBusy(true); setErr('');
    try {
      const out = await onConfirm(reason.trim());
      if (out) setDone(out); else onClose();
    } catch (e: any) { setErr(e.message || 'Something went wrong'); }
    setBusy(false);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        {done ? (
          <>
            <div className="mt-3 text-sm text-gray-700">{done}</div>
            <button onClick={onClose} className="mt-4 w-full rounded-lg bg-gray-800 py-2.5 text-xs font-bold text-white hover:bg-gray-900">Close</button>
          </>
        ) : (
          <>
            <div className="mt-2 space-y-2 text-xs text-gray-600">{children}</div>
            {askReason && (
              <label className="mt-3 block text-xs"><span className="mb-1 block font-semibold text-gray-700">Reason (shown in the records)</span>
                <input value={reason} onChange={e => setReason(e.target.value)} maxLength={120} placeholder="e.g. Server problem during this round"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none" /></label>
            )}
            {err && <p className="mt-3 text-xs font-semibold text-red-700">⚠️ {err}</p>}
            <div className="mt-4 flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-lg border border-gray-300 py-2.5 text-xs font-bold hover:bg-gray-50">Cancel</button>
              <button onClick={run} disabled={busy} className={`flex-1 rounded-lg py-2.5 text-xs font-bold text-white disabled:opacity-50 ${btn}`}>
                {busy ? 'Working…' : confirmLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Day-by-day report table used on the 99x and trading pages.
export function DailyReport({ days, extra }: {
  days: { date: string; bets: number; players: number; staked: number; paid: number; net: number; refunded: number; [k: string]: any }[];
  extra?: { label: string; render: (row: any) => ReactNode };
}) {
  const tot = days.reduce((a, d) => ({ bets: a.bets + d.bets, staked: a.staked + d.staked, paid: a.paid + d.paid, refunded: a.refunded + d.refunded }), { bets: 0, staked: 0, paid: 0, refunded: 0 });
  return (
    <div className="max-h-[360px] overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-gray-50 text-left text-[11px] uppercase text-gray-500">
          <tr><th className="px-2 py-2">Date</th><th className="px-2 py-2 text-right">Bets</th><th className="px-2 py-2 text-right">Players</th>
            <th className="px-2 py-2 text-right">Staked</th><th className="px-2 py-2 text-right">Paid</th><th className="px-2 py-2 text-right">Net</th>
            <th className="px-2 py-2 text-right">Refunded</th>{extra && <th className="px-2 py-2 text-right">{extra.label}</th>}</tr>
        </thead>
        <tbody>
          {days.map(d => (
            <tr key={d.date} className="border-t border-gray-100">
              <td className="px-2 py-1.5 font-semibold">{d.date}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{d.bets}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{d.players}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{inr(d.staked)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{inr(d.paid)}</td>
              <td className={`px-2 py-1.5 text-right font-bold tabular-nums ${d.net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{inr(d.net)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{d.refunded ? inr(d.refunded) : '—'}</td>
              {extra && <td className="px-2 py-1.5 text-right tabular-nums">{extra.render(d)}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-bold">
          <tr><td className="px-2 py-2">Total</td><td className="px-2 py-2 text-right tabular-nums">{tot.bets}</td><td />
            <td className="px-2 py-2 text-right tabular-nums">{inr(tot.staked)}</td><td className="px-2 py-2 text-right tabular-nums">{inr(tot.paid)}</td>
            <td className={`px-2 py-2 text-right tabular-nums ${tot.staked - tot.paid >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{inr(tot.staked - tot.paid)}</td>
            <td className="px-2 py-2 text-right tabular-nums text-gray-500">{tot.refunded ? inr(tot.refunded) : '—'}</td>{extra && <td />}</tr>
        </tfoot>
      </table>
    </div>
  );
}

export function ExportButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} title="Download as CSV (opens in Excel)"
      className="rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold hover:bg-gray-50 disabled:opacity-40">⬇ CSV</button>
  );
}

// 99x Matka pick label: 'A3' -> 'Andar 3', 'B7' -> 'Bahar 7', Jodi numbers unchanged
export const matkaPick = (option: string | null | undefined) =>
  option && /^[AB]\d$/.test(option) ? `${option[0] === 'A' ? 'Andar' : 'Bahar'} ${option[1]}` : (option ?? '—');
