import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export const inr = (n: number | null | undefined) =>
  `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (x: number) => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
};

// A 1-second clock kept in step with the server's time (phone clocks can be wrong).
export function useServerNow(serverTime: number | undefined) {
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (serverTime) setOffset(serverTime - Date.now()); }, [serverTime]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  return now + offset;
}

export const SUITS: Record<string, { sym: string; red: boolean; name: string }> = {
  S: { sym: '♠', red: false, name: 'Spades' },
  H: { sym: '♥', red: true, name: 'Hearts' },
  D: { sym: '♦', red: true, name: 'Diamonds' },
  C: { sym: '♣', red: false, name: 'Clubs' }
};
export const cardParts = (code: string) => ({ rank: code.slice(0, -1), suit: code.slice(-1) });

export const COLOURS: Record<string, { name: string; bg: string; ring: string; text: string; hex: string }> = {
  RED: { name: 'Red', bg: 'bg-[#FF4D5E]', ring: 'ring-[#FF4D5E]', text: 'text-[#FF4D5E]', hex: '#FF4D5E' },
  BLUE: { name: 'Blue', bg: 'bg-[#3D8BFF]', ring: 'ring-[#3D8BFF]', text: 'text-[#3D8BFF]', hex: '#3D8BFF' },
  GREEN: { name: 'Green', bg: 'bg-[#2ECC8F]', ring: 'ring-[#2ECC8F]', text: 'text-[#2ECC8F]', hex: '#2ECC8F' }
};

// Small inline rendering of any game option (number, card code or colour)
export function OptionTag({ game, value, size = 'sm' }: { game: string; value: string | null | undefined; size?: 'sm' | 'lg' }) {
  if (!value) return <span className="text-gray-500">—</span>;
  const big = size === 'lg';
  if (game === 'card') {
    const { rank, suit } = cardParts(value);
    const s = SUITS[suit];
    return (
      <span className={`inline-flex items-center justify-center rounded-md bg-[#F5EDE2] font-extrabold shadow ${big ? 'w-10 h-14 text-lg' : 'px-1.5 py-0.5 text-xs'} ${s?.red ? 'text-[#E23B52]' : 'text-[#0A0F0D]'}`}>
        {rank}{s?.sym}
      </span>
    );
  }
  if (game === 'colour') {
    const c = COLOURS[value];
    return (
      <span className={`inline-flex items-center gap-1.5 font-bold ${big ? 'text-base' : 'text-xs'} text-white`}>
        <span className={`rounded-full ${c?.bg} ${big ? 'w-5 h-5' : 'w-3 h-3'}`} />{c?.name}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center justify-center rounded-md border border-[#C9A87C]/50 bg-[#0A0F0D] font-mono font-extrabold text-[#F0DDB8] ${big ? 'w-11 h-11 text-lg' : 'px-1.5 py-0.5 text-xs'}`}>
      {value}
    </span>
  );
}

// Countdown ring: fills as the betting window runs out, amber in the last 10%, grey when locked.
export function CountdownRing({ now, start, lock, end, size = 96 }: { now: number; start: number; lock: number; end: number; size?: number }) {
  const locked = now >= lock;
  const total = locked ? end - lock : lock - start;
  const left = locked ? end - now : lock - now;
  const frac = total > 0 ? Math.min(1, Math.max(0, left / total)) : 0;
  const r = size / 2 - 7;
  const circ = 2 * Math.PI * r;
  const colour = locked ? '#8FA89B' : frac < 0.1 ? '#F5B544' : '#3EE08A';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="6" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={colour} strokeWidth="6" fill="none" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - frac)} style={{ transition: 'stroke-dashoffset 0.3s linear, stroke 0.3s' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-base font-extrabold tabular-nums text-white">{clock(left)}</span>
        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: colour }}>{locked ? 'Result in' : 'Closes in'}</span>
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: 'open' | 'locked' | 'result' }) {
  if (status === 'open') {
    return <span className="inline-flex items-center gap-1.5 rounded-full border border-[#3EE08A]/40 bg-[#3EE08A]/10 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#3EE08A]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3EE08A]" />Betting open</span>;
  }
  if (status === 'locked') {
    return <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-600 bg-white/5 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-gray-300">🔒 Locked</span>;
  }
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C9A87C]/50 bg-[#C9A87C]/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#E0C9A0]">Result</span>;
}

export function GlassCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[#C9A87C]/20 bg-gradient-to-br from-[#123A2C]/70 to-[#0A0F0D]/80 shadow-xl backdrop-blur ${className}`}>
      {children}
    </div>
  );
}

export const AMOUNT_CHIPS = [10, 50, 100, 500, 1000];

export function AmountPicker({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min: number; max: number }) {
  const [custom, setCustom] = useState('');
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {AMOUNT_CHIPS.filter(a => a >= min && a <= max).map(a => (
          <button key={a} onClick={() => { onChange(a); setCustom(''); }}
            className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition-all active:scale-95 ${value === a && !custom ? 'bg-gradient-to-r from-[#E0C9A0] to-[#C9A87C] text-[#0A0F0D] shadow-lg shadow-[#C9A87C]/20' : 'border border-[#1E5C46] bg-[#0C241B] text-gray-300 hover:border-[#C9A87C]/60 hover:text-white'}`}>
            ₹{a.toLocaleString('en-IN')}
          </button>
        ))}
        <input inputMode="numeric" placeholder="Custom ₹" value={custom}
          onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); setCustom(v); if (v) onChange(parseInt(v, 10)); }}
          className="w-24 rounded-full border border-[#1E5C46] bg-[#0A0F0D] px-3 py-1.5 text-xs font-bold text-white placeholder-gray-500 focus:border-[#C9A87C] focus:outline-none" />
      </div>
      <p className="text-[10px] text-gray-500">₹{min.toLocaleString('en-IN')} min · ₹{max.toLocaleString('en-IN')} max per pick</p>
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="g-sheet w-full max-w-md rounded-t-3xl border-t border-[#C9A87C]/30 bg-[#0C1712] p-5 pb-8" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-600" />
        <h3 className="mb-3 text-base font-extrabold text-white">{title}</h3>
        {children}
        <button onClick={onClose} className="mt-5 w-full rounded-xl bg-gradient-to-r from-[#E0C9A0] to-[#C9A87C] py-3 text-sm font-extrabold text-[#0A0F0D]">Got it</button>
      </div>
    </div>
  );
}
