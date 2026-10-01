import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Info, ShieldCheck } from 'lucide-react';
import { gamesGet, gamesPost, API_BASE } from './api';
import { inr, Sheet } from './ui';
import type { Balances } from './TradingPage';

// ---------- types (mirror backend/src/games/jetEngine.js) ----------
type Phase = 'betting' | 'flying' | 'ended' | 'void' | 'paused' | 'waiting';
type JRound = {
  id?: string; no?: number; phase: Phase; hash?: string; edge?: number;
  bettingEndsAt?: number; flyAt?: number | null; point?: number | null; seed?: string | null;
  endedAt?: number | null; nextAt?: number | null;
};
type JConfig = {
  enabled: boolean; minBet: number; maxBet: number; maxWin: number; bettingSec: number; edgePct: number;
  roundCap: number; maxPoint: number; minCashout: number; growth: number; pauseMs: number;
};
type LiveBet = { name: string; amount: number; cashout: number | null; win: number; status: string };
type Live = { roundId: string | null; count: number; players: number; staked: number; bets: LiveBet[] };
type Fairness = { terminatingHash: string | null; salt: string | null; chainId: string | null; chainLength: number; formula: string };
type JState = {
  serverTime: number; config: JConfig; round: JRound; history: { id: string; point: number }[];
  live: Live; fairness: Fairness; ruleLine: string; rules: string[];
};
type Active = { id: string; slot: number; roundId: string; amount: number; auto: number | null; status: string; cashout: number | null; win: number; queued: boolean };
type MyBet = { id: string; roundId: string; slot: number; amount: number; auto: number | null; status: string; cashout: number | null; win_amount: number; result: number | null; created_at: string };
type Proof = { id: string; hash: string; seed: string; edge: number; point: number | null; phase: string; salt: string | null; terminatingHash: string | null; chainIndex: number };

const multAt = (growth: number, ms: number) => (ms <= 0 ? 1 : Math.floor(Math.exp(growth * ms) * 100 + 1e-9) / 100);
const fmtX = (x: number | null | undefined) => (x == null ? '—' : `${x.toFixed(2)}x`);
const pointColour = (p: number) => (p >= 10 ? 'text-[#F0C36A] border-[#F0C36A]/50 bg-[#F0C36A]/10' : p >= 2 ? 'text-[#3EE08A] border-[#3EE08A]/40 bg-[#3EE08A]/10' : 'text-gray-300 border-gray-700 bg-white/5');

// ---------- browser-side check of a round (same maths as the server) ----------
async function verifyProof(p: Proof) {
  const enc = new TextEncoder();
  const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
  const hash = hex(await crypto.subtle.digest('SHA-256', enc.encode(p.seed)));
  const key = await crypto.subtle.importKey('raw', enc.encode(p.seed), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = hex(await crypto.subtle.sign('HMAC', key, enc.encode(p.salt || '')));
  const r = parseInt(mac.slice(0, 13), 16) / 2 ** 52;
  const keep = (10000 - Math.round(p.edge * 10000)) / 100;
  const point = Math.min(2000, Math.max(1, Math.floor(keep / (1 - r)) / 100));
  return { hashOk: hash === p.hash, point, pointOk: p.point === null ? null : point === p.point };
}

// ---------- live connection: server-sent events, polling as a fallback ----------
function useJetLive(onRoundEnd: () => void) {
  const [st, setSt] = useState<JState | null>(null);
  const [error, setError] = useState('');
  const offset = useRef(0);
  const lastEvent = useRef(0);
  const endRef = useRef(onRoundEnd);
  endRef.current = onRoundEnd;

  const poll = useCallback(async () => {
    try {
      const d = await gamesGet<JState>('/api/games/jet/state');
      offset.current = d.serverTime - Date.now();
      setSt(d);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Could not load 99x Jet');
    }
  }, []);

  useEffect(() => {
    let es: EventSource | null = null;
    let alive = true;
    const seen = (data: { serverTime?: number }) => {
      lastEvent.current = Date.now();
      if (data.serverTime) offset.current = data.serverTime - Date.now();
    };
    const on = (type: string, fn: (d: any) => void) => es?.addEventListener(type, (ev: MessageEvent) => {
      try { const d = JSON.parse(ev.data); seen(d); fn(d); } catch { /* ignore a bad frame */ }
    });
    try {
      es = new EventSource(`${API_BASE}/api/games/jet/stream`);
      on('state', d => { setSt(d); setError(''); });
      on('round', d => setSt(s => (s ? { ...s, round: d.round, live: { roundId: d.round.id, count: 0, players: 0, staked: 0, bets: [] } } : s)));
      on('fly', d => setSt(s => (s ? { ...s, round: d.round } : s)));
      on('blast', d => {
        setSt(s => (s ? { ...s, round: d.round, history: d.round.point != null ? [{ id: d.round.id, point: d.round.point }, ...s.history].slice(0, 30) : s.history } : s));
        endRef.current();
      });
      on('bets', d => setSt(s => (s ? { ...s, live: d } : s)));
      on('paused', () => setSt(s => (s ? { ...s, round: { phase: 'paused' } } : s)));
      on('config', d => setSt(s => (s ? { ...s, config: d.config } : s)));
      on('busy', () => { es?.close(); es = null; });
    } catch { es = null; }
    poll();
    // If the stream is down (or a proxy buffers it), fall back to polling.
    const id = setInterval(() => {
      if (!alive) return;
      const quiet = Date.now() - lastEvent.current > 20000;
      if (!es || es.readyState !== 1 || quiet) poll();
    }, 1500);
    const vis = () => { if (document.visibilityState === 'visible') poll(); };
    document.addEventListener('visibilitychange', vis);
    return () => { alive = false; es?.close(); clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, [poll]);

  const serverNow = useCallback(() => Date.now() + offset.current, []);
  return { st, error, serverNow, poll };
}

// A clock that re-renders every `ms` milliseconds.
function useTicker(ms: number) {
  const [, set] = useState(0);
  useEffect(() => { const id = setInterval(() => set(x => x + 1), ms); return () => clearInterval(id); }, [ms]);
}

// ---------- the flight picture ----------
function JetIcon({ x, y, angle }: { x: number; y: number; angle: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(0.32)`}>
      <ellipse cx="-96" cy="0" rx="46" ry="14" fill="url(#jflame)" />
      <path d="M-70,-10 L40,-12 Q78,-10 92,0 Q78,10 40,12 L-70,10 Z" fill="url(#jbody)" />
      <path d="M-6,-10 L-40,-62 L-22,-62 L28,-10 Z" fill="#C9A87C" />
      <path d="M-6,10 L-40,62 L-22,62 L28,10 Z" fill="#B08E5E" />
      <path d="M-70,-8 L-88,-34 L-76,-34 L-52,-8 Z" fill="#C9A87C" />
      <path d="M-70,8 L-88,34 L-76,34 L-52,8 Z" fill="#B08E5E" />
      <ellipse cx="56" cy="-3" rx="16" ry="5" fill="#163A52" opacity=".85" />
    </g>
  );
}

function Flight({ round, config, serverNow }: { round: JRound; config: JConfig; serverNow: () => number }) {
  const [, setFrame] = useState(0);
  const flying = round.phase === 'flying' && !!round.flyAt;
  useEffect(() => {
    if (!flying) return;
    let raf = 0;
    const loop = () => { setFrame(f => f + 1); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [flying]);
  useTicker(flying ? 100000 : 100);

  const W = 360, H = 210, x0 = 18, y0 = 188;
  const now = serverNow();
  const ended = round.phase === 'ended' || round.phase === 'void';
  const flownMs = round.flyAt ? (ended && round.endedAt ? round.endedAt - round.flyAt : Math.max(0, now - round.flyAt)) : 0;
  const m = ended && round.point != null ? round.point : multAt(config.growth, flownMs);
  const spanMs = Math.max(8000, flownMs * 1.12);
  const topM = Math.max(2, m * 1.15);
  const px = (ms: number) => x0 + (ms / spanMs) * (W - 60);
  const py = (mm: number) => y0 - ((mm - 1) / (topM - 1)) * (H - 60);
  const steps = 48;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (flownMs * i) / steps;
    pts.push(`${px(t).toFixed(1)},${py(Math.exp(config.growth * t)).toFixed(1)}`);
  }
  const tipX = px(flownMs), tipY = py(Math.exp(config.growth * flownMs));
  const prevT = Math.max(0, flownMs - spanMs / 30);
  const climb = flownMs > 0 ? (Math.atan2(py(Math.exp(config.growth * prevT)) - tipY, tipX - px(prevT)) * 180) / Math.PI : 12;
  const angle = -Math.max(8, Math.min(70, climb));

  const bettingLeft = round.bettingEndsAt ? Math.max(0, round.bettingEndsAt - now) : 0;
  const bettingFrac = config.bettingSec > 0 ? Math.min(1, bettingLeft / (config.bettingSec * 1000)) : 0;

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-[#C9A87C]/25 bg-[radial-gradient(ellipse_at_70%_80%,#163A52_0%,#0B2233_45%,#05101A_100%)] ${round.phase === 'ended' ? 'g-jet-shake' : ''}`}>
      <div className="pointer-events-none absolute -bottom-1/2 -left-1/4 h-[200%] w-[150%] opacity-60 g-jet-rays"
        style={{ background: 'repeating-conic-gradient(from 0deg at 50% 50%, rgba(240,221,184,.06) 0deg 5deg, transparent 5deg 14deg)' }} />
      <svg viewBox={`0 0 ${W} ${H}`} className="relative block w-full" role="img" aria-label="Flight">
        <defs>
          <linearGradient id="jarea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E0C9A0" stopOpacity=".35" /><stop offset="1" stopColor="#E0C9A0" stopOpacity="0" /></linearGradient>
          <linearGradient id="jbody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFF6DF" /><stop offset=".45" stopColor="#E8C88E" /><stop offset="1" stopColor="#8A6D47" /></linearGradient>
          <radialGradient id="jflame" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#FFF3C4" /><stop offset=".4" stopColor="#FFB547" /><stop offset="1" stopColor="#FF5A2A" stopOpacity="0" /></radialGradient>
        </defs>
        <line x1={x0} y1={y0} x2={W - 12} y2={y0} stroke="rgba(224,201,160,.25)" />
        <line x1={x0} y1={y0} x2={x0} y2={14} stroke="rgba(224,201,160,.25)" />
        {(round.phase === 'flying' || round.phase === 'ended') && flownMs > 0 && (
          <>
            <polygon points={`${x0},${y0} ${pts.join(' ')} ${tipX.toFixed(1)},${y0}`} fill="url(#jarea)" />
            <polyline points={pts.join(' ')} fill="none" stroke={round.phase === 'ended' ? '#FF5A5F' : '#F0DDB8'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
        {round.phase === 'flying' && <JetIcon x={tipX} y={tipY} angle={angle} />}
        {round.phase === 'ended' && (
          <g transform={`translate(${tipX} ${tipY})`}>
            <circle r="16" fill="#FF5A2A" opacity=".35" className="g-pop" />
            <circle r="8" fill="#FFB547" opacity=".8" className="g-pop" />
          </g>
        )}
        {round.phase === 'betting' && <JetIcon x={x0 + 24} y={y0 - 8} angle={-8} />}
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {round.phase === 'flying' && (
          <p className="font-mono text-5xl font-black tabular-nums text-white drop-shadow-[0_4px_18px_rgba(240,221,184,.45)]">{m.toFixed(2)}x</p>
        )}
        {round.phase === 'ended' && (
          <>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-[#FF6B70]">Blasted</p>
            <p className="g-pop font-mono text-5xl font-black tabular-nums text-[#FF6B70] drop-shadow-[0_4px_18px_rgba(255,90,95,.45)]">{fmtX(round.point)}</p>
          </>
        )}
        {round.phase === 'void' && <p className="max-w-[80%] text-sm font-bold text-amber-300">Round cancelled · open bets refunded</p>}
        {round.phase === 'betting' && (
          <div className="w-3/5">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-[#BFE0F5]">Place your bets</p>
            <p className="mt-1 font-mono text-3xl font-black tabular-nums text-white">{(bettingLeft / 1000).toFixed(1)}s</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-[#3EE08A] to-[#F0DDB8]" style={{ width: `${bettingFrac * 100}%` }} />
            </div>
          </div>
        )}
        {(round.phase === 'paused' || round.phase === 'waiting') && (
          <p className="text-sm font-bold text-gray-300">{round.phase === 'paused' ? '99x Jet is paused right now' : 'Next round starting…'}</p>
        )}
      </div>
    </div>
  );
}

// ---------- one bet panel ----------
function BetPanel({ slot, st, active, now, mobile, balance, onDone, onError }: {
  slot: 1 | 2; st: JState; active: Active | undefined; now: number; mobile: string; balance: number;
  onDone: (d: { balances?: Balances | null; text: string }) => void; onError: (t: string) => void;
}) {
  const cfg = st.config;
  const r = st.round;
  const [mode, setMode] = useState<'bet' | 'auto'>(slot === 1 ? 'bet' : 'auto');
  const [amount, setAmount] = useState(Math.max(cfg.minBet, slot === 1 ? 100 : 50));
  const [auto, setAuto] = useState(slot === 1 ? '2.00' : '3.00');
  const [busy, setBusy] = useState(false);

  const inRound = !!active && !active.queued && active.roundId === r.id;
  const pending = active && active.status === 'pending';
  const flying = r.phase === 'flying' && !!r.flyAt;
  const live = flying ? multAt(cfg.growth, now - (r.flyAt || 0)) : 1;
  const bettingOpen = r.phase === 'betting' && (r.bettingEndsAt || 0) > now;
  const canCashOut = !!pending && inRound && flying;
  const canCancel = !!pending && (active!.queued || (inRound && bettingOpen));
  const won = active && active.status === 'won' && inRound;
  const locked = !!pending;

  const call = async (path: string, body: object, text: (d: any) => string) => {
    if (!mobile) { onError('Please log in to play.'); return; }
    setBusy(true);
    try {
      const d = await gamesPost<any>(path, { mobile, slot, ...body });
      onDone({ balances: d.balances, text: text(d) });
    } catch (e: any) {
      onError(e.message || 'Something went wrong');
    }
    setBusy(false);
  };

  const place = () => {
    if (amount > balance + 0.001) { onError(`Not enough balance. You need ${inr(amount)}.`); return; }
    const target = mode === 'auto' ? Number(auto) : null;
    if (mode === 'auto' && (!Number.isFinite(target!) || target! < cfg.minCashout)) { onError(`Auto cash-out must be at least ${cfg.minCashout.toFixed(2)}x`); return; }
    call('/api/games/jet/bet', { amount, autoCashout: target }, d => (d.queued ? `Bet ${slot}: ${inr(amount)} placed for the next round` : `Bet ${slot}: ${inr(amount)} placed`));
  };

  let button: { label: string; sub?: string; cls: string; onClick?: () => void; disabled?: boolean };
  if (canCashOut) {
    button = { label: 'CASH OUT', sub: inr(Math.min(cfg.maxWin, Math.floor(active!.amount * live * 100) / 100)), cls: 'from-[#FFB547] to-[#F08A24] text-[#1A0F06] shadow-[#F08A24]/30', onClick: () => call('/api/games/jet/cashout', {}, d => `Bet ${slot}: cashed out at ${fmtX(d.x)} · won ${inr(d.win)}`) };
  } else if (canCancel) {
    button = { label: 'CANCEL', sub: active!.queued ? 'waiting for next round' : `${inr(active!.amount)} placed`, cls: 'from-[#FF6B70] to-[#E23B52] text-white shadow-[#E23B52]/30', onClick: () => call('/api/games/jet/cancel', {}, () => `Bet ${slot} cancelled · ${inr(active!.amount)} refunded`) };
  } else if (pending && inRound && !flying) {
    button = { label: 'WAITING', sub: 'take-off', cls: 'from-gray-600 to-gray-700 text-white', disabled: true };
  } else if (!cfg.enabled || r.phase === 'paused') {
    button = { label: 'PAUSED', cls: 'from-gray-600 to-gray-700 text-white', disabled: true };
  } else {
    button = { label: `BET ${inr(amount)}`, sub: bettingOpen ? undefined : 'next round', cls: 'from-[#3EE08A] to-[#1E9C68] text-[#04140C] shadow-[#3EE08A]/25', onClick: place };
  }

  const step = (d: number) => setAmount(a => Math.min(cfg.maxBet, Math.max(cfg.minBet, a + d)));

  return (
    <div className="rounded-2xl border border-[#1E5C46] bg-[#0C1712] p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex rounded-full border border-gray-800 bg-[#0A0F0D] p-0.5">
          {(['bet', 'auto'] as const).map(mm => (
            <button key={mm} disabled={locked} onClick={() => setMode(mm)}
              className={`rounded-full px-3 py-1 text-[11px] font-extrabold transition-all ${mode === mm ? 'bg-[#1E8A6E] text-white' : 'text-gray-400 hover:text-white'} disabled:opacity-60`}>
              {mm === 'bet' ? 'Bet' : 'Auto'}
            </button>
          ))}
        </div>
        {won
          ? <span className="text-[11px] font-extrabold text-[#3EE08A]">Won {inr(active!.win)} at {fmtX(active!.cashout)}</span>
          : active && active.status === 'lost' && inRound
            ? <span className="text-[11px] font-bold text-gray-500">Lost {inr(active.amount)}</span>
            : <span className="text-[10px] font-bold text-gray-500">Bet {slot}</span>}
      </div>
      <div className="flex gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center rounded-full border border-gray-700 bg-[#0A0F0D]">
            <button disabled={locked} onClick={() => step(-10)} className="h-9 w-9 shrink-0 text-lg font-bold text-gray-300 disabled:opacity-40">−</button>
            <input inputMode="numeric" disabled={locked} value={amount}
              onChange={e => { const v = parseInt(e.target.value.replace(/[^0-9]/g, '') || '0', 10); setAmount(Math.min(cfg.maxBet, v)); }}
              onBlur={() => setAmount(a => Math.max(cfg.minBet, a))}
              className="w-full min-w-0 bg-transparent text-center font-mono text-sm font-extrabold text-white focus:outline-none disabled:opacity-60" />
            <button disabled={locked} onClick={() => step(10)} className="h-9 w-9 shrink-0 text-lg font-bold text-gray-300 disabled:opacity-40">+</button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {[10, 50, 100, 500].filter(v => v >= cfg.minBet && v <= cfg.maxBet).map(v => (
              <button key={v} disabled={locked} onClick={() => setAmount(v)}
                className={`rounded-md py-1 text-[10px] font-bold ${amount === v ? 'bg-[#C9A87C] text-[#0A0F0D]' : 'bg-white/5 text-gray-300'} disabled:opacity-50`}>₹{v}</button>
            ))}
          </div>
          {mode === 'auto' && (
            <label className="flex items-center justify-between gap-2 text-[11px] font-bold text-gray-400">
              Auto cash-out
              <span className="flex items-center rounded-md border border-gray-700 bg-[#0A0F0D] px-2">
                <input inputMode="decimal" disabled={locked} value={auto} onChange={e => setAuto(e.target.value.replace(/[^0-9.]/g, ''))}
                  className="w-14 bg-transparent py-1 text-right font-mono text-xs font-extrabold text-white focus:outline-none disabled:opacity-60" />
                <span className="text-gray-500">x</span>
              </span>
            </label>
          )}
        </div>
        <button onClick={button.onClick} disabled={busy || button.disabled}
          className={`flex w-[44%] shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-b px-2 py-3 shadow-lg transition-transform active:scale-[0.97] disabled:opacity-60 ${button.cls}`}>
          <span className="text-sm font-black tracking-wider">{busy ? '…' : button.label}</span>
          {button.sub && <span className="mt-0.5 font-mono text-[12px] font-extrabold tabular-nums opacity-90">{button.sub}</span>}
          {pending && active!.auto && <span className="mt-0.5 text-[10px] font-bold opacity-80">auto at {fmtX(active!.auto)}</span>}
        </button>
      </div>
    </div>
  );
}

// ---------- the page ----------
export default function JetPage({ mobile, balance, onBack, onBalances }: {
  mobile: string; balance: number; onBack: () => void; onBalances: (b: Balances) => void;
}) {
  const [active, setActive] = useState<Active[]>([]);
  const [myBets, setMyBets] = useState<MyBet[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [showRules, setShowRules] = useState(false);
  const [showFair, setShowFair] = useState(false);
  const [proof, setProof] = useState<{ p: Proof; check: { hashOk: boolean; point: number; pointOk: boolean | null } } | null>(null);
  const [proofErr, setProofErr] = useState('');
  const prevActive = useRef<Active[]>([]);
  const balancesRef = useRef(onBalances);
  balancesRef.current = onBalances;

  const loadMine = useCallback(async () => {
    if (!mobile) return;
    try {
      const d = await gamesGet<{ bets: MyBet[]; active: Active[]; balances?: Balances }>(`/api/games/jet/my-bets?mobile=${mobile}`);
      // tell the player about auto cash-outs and losses that happened since the last look
      for (const a of d.active) {
        const before = prevActive.current.find(p => p.id === a.id);
        if (before && before.status === 'pending' && a.status === 'won') setMsg({ ok: true, text: `Bet ${a.slot}: cashed out at ${fmtX(a.cashout)} · won ${inr(a.win)}` });
      }
      prevActive.current = d.active;
      setActive(d.active);
      setMyBets(d.bets || []);
      if (d.balances) balancesRef.current(d.balances);
    } catch { /* keep the last view */ }
  }, [mobile]);

  const { st, error, serverNow } = useJetLive(loadMine);
  useTicker(100);
  const now = serverNow();

  useEffect(() => { loadMine(); const id = setInterval(loadMine, 6000); return () => clearInterval(id); }, [loadMine]);
  // reload my bets when a new round opens (queued bets move into it)
  const roundId = st?.round.id;
  useEffect(() => { if (roundId) loadMine(); }, [roundId, loadMine]);
  // auto cash-outs show up in the live list; refresh my view when it changes
  const myLiveWins = st?.live.bets.filter(b => b.status === 'won').length || 0;
  useEffect(() => { if (myLiveWins) loadMine(); }, [myLiveWins, loadMine]);
  useEffect(() => { if (msg) { const id = setTimeout(() => setMsg(null), 4000); return () => clearTimeout(id); } }, [msg]);

  const slotActive = useMemo(() => {
    const pick = (slot: number) => {
      const list = active.filter(a => a.slot === slot);
      return list.find(a => a.status === 'pending' && !a.queued) || list.find(a => a.queued) || list.find(a => !a.queued);
    };
    return { 1: pick(1), 2: pick(2) };
  }, [active]);

  const openProof = async (id: string) => {
    setProofErr(''); setProof(null);
    try {
      const d = await gamesGet<{ round: Proof }>(`/api/games/jet/round/${encodeURIComponent(id)}`);
      const check = await verifyProof(d.round);
      setProof({ p: d.round, check });
    } catch (e: any) {
      setProofErr(e.message || 'Could not check this round');
    }
  };

  if (!st) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-[#06120C] text-white">
        <p className="text-sm text-gray-400">{error || 'Loading 99x Jet…'}</p>
        <button onClick={onBack} className="text-xs font-bold text-[#E0C9A0]">← Back</button>
      </div>
    );
  }

  const handleDone = (d: { balances?: Balances | null; text: string }) => {
    if (d.balances) balancesRef.current(d.balances);
    setMsg({ ok: true, text: d.text });
    loadMine();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#06120C] text-white">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-800/80 bg-[#0A0F0D]/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="rounded-full p-1 text-gray-300 hover:bg-white/5 hover:text-white" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
          <div>
            <h2 className="text-base font-black tracking-wide">99x Jet</h2>
            <p className="text-[10px] font-semibold text-[#E0C9A0]">Fair crash game · up to {st.config.maxPoint}x</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowRules(true)} className="rounded-full border border-gray-700 p-1.5 text-gray-300 hover:text-white" aria-label="How it works"><Info className="h-4 w-4" /></button>
          <span className="rounded-full border border-[#C9A87C]/40 bg-[#0C241B] px-3 py-1 text-xs font-extrabold tabular-nums text-[#F0DDB8]">{inr(balance)}</span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md flex-1 space-y-3 px-4 pb-16 pt-3">
        {/* last blast points */}
        <div className="g-noscroll flex gap-1.5 overflow-x-auto">
          {st.history.length === 0 && <span className="text-[11px] text-gray-500">No rounds yet</span>}
          {st.history.map(h => (
            <button key={h.id} onClick={() => { setShowFair(true); openProof(h.id); }}
              className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-extrabold tabular-nums ${pointColour(h.point)}`}>
              {h.point.toFixed(2)}x
            </button>
          ))}
        </div>

        <Flight round={st.round} config={st.config} serverNow={serverNow} />

        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span className="truncate font-mono">{st.round.id || '—'}{st.round.hash ? ` · code ${st.round.hash.slice(0, 10)}…` : ''}</span>
          <button onClick={() => setShowFair(true)} className="inline-flex shrink-0 items-center gap-1 font-bold text-[#E0C9A0] hover:text-white"><ShieldCheck className="h-3.5 w-3.5" /> Fair play</button>
        </div>

        {msg && (
          <div className={`rounded-xl border px-3 py-2 text-center text-xs font-bold ${msg.ok ? 'border-[#3EE08A]/40 bg-[#3EE08A]/10 text-[#3EE08A]' : 'border-red-500/40 bg-red-500/10 text-red-300'}`}>{msg.text}</div>
        )}

        <BetPanel slot={1} st={st} active={slotActive[1]} now={now} mobile={mobile} balance={balance} onDone={handleDone} onError={t => setMsg({ ok: false, text: t })} />
        <BetPanel slot={2} st={st} active={slotActive[2]} now={now} mobile={mobile} balance={balance} onDone={handleDone} onError={t => setMsg({ ok: false, text: t })} />
        <p className="text-center text-[10px] text-gray-500">
          {inr(st.config.minBet)}–{inr(st.config.maxBet)} per bet · max win {inr(st.config.maxWin)} per bet · {st.config.edgePct}% house edge
        </p>

        {/* live bets / my bets */}
        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-[#0A0F0D]">
          <div className="flex border-b border-gray-800">
            {(['all', 'mine'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-[11px] font-extrabold ${tab === t ? 'text-[#F0DDB8]' : 'text-gray-500'}`}>
                {t === 'all' ? `All bets · ${st.live.count}` : 'My bets'}
              </button>
            ))}
          </div>
          {tab === 'all' ? (
            <div>
              <div className="flex justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                <span>{st.live.players} players</span><span>{inr(st.live.staked)} staked</span>
              </div>
              {st.live.bets.length === 0 && <p className="px-3 pb-4 pt-2 text-center text-[11px] text-gray-500">No bets in this round yet.</p>}
              {st.live.bets.map((b, i) => (
                <div key={i} className={`grid grid-cols-4 items-center px-3 py-1.5 text-[11px] ${b.status === 'won' ? 'bg-[#3EE08A]/5' : ''}`}>
                  <span className="truncate font-mono text-gray-300">{b.name}</span>
                  <span className="text-right font-bold tabular-nums text-white">{inr(b.amount)}</span>
                  <span className={`text-right font-mono font-bold ${b.status === 'won' ? 'text-[#3EE08A]' : b.status === 'lost' ? 'text-gray-600' : 'text-gray-400'}`}>
                    {b.status === 'won' ? fmtX(b.cashout) : b.status === 'lost' ? 'lost' : st.round.phase === 'flying' ? 'flying' : '—'}
                  </span>
                  <span className={`text-right font-extrabold tabular-nums ${b.status === 'won' ? 'text-[#3EE08A]' : 'text-gray-600'}`}>{b.status === 'won' ? inr(b.win) : '—'}</span>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {myBets.length === 0 && <p className="px-3 py-4 text-center text-[11px] text-gray-500">{mobile ? 'No 99x Jet bets yet.' : 'Log in to see your bets.'}</p>}
              {myBets.slice(0, 30).map(b => (
                <div key={b.id} className="grid grid-cols-4 items-center border-b border-gray-900 px-3 py-1.5 text-[11px] last:border-0">
                  <span className="truncate font-mono text-gray-500">{b.roundId}</span>
                  <span className="text-right font-bold tabular-nums text-white">{inr(b.amount)}</span>
                  <span className="text-right font-mono font-bold text-gray-400">
                    {b.status === 'won' ? fmtX(b.cashout) : b.status === 'lost' ? `✕ ${fmtX(b.result)}` : b.status === 'refunded' ? 'refunded' : 'open'}
                  </span>
                  <span className={`text-right font-extrabold tabular-nums ${b.status === 'won' ? 'text-[#3EE08A]' : 'text-gray-600'}`}>{b.status === 'won' ? `+${inr(b.win_amount)}` : '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Sheet open={showRules} onClose={() => setShowRules(false)} title="How 99x Jet works">
        <ul className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
          {st.rules.map((line, i) => (
            <li key={i} className="flex gap-2 text-[12px] leading-snug text-gray-300"><span className="text-[#E0C9A0]">•</span>{line}</li>
          ))}
        </ul>
      </Sheet>

      <Sheet open={showFair} onClose={() => { setShowFair(false); setProof(null); setProofErr(''); }} title="Fair play">
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1 text-[11px] text-gray-300">
          <p>Every blast point is fixed before betting opens. Before a round you see its code; after the blast the seed is shown, and anyone can recompute the point.</p>
          <div className="space-y-1 rounded-xl border border-gray-800 bg-[#0A0F0D] p-3 font-mono text-[10px] break-all">
            <p><span className="text-gray-500">Chain end (published): </span>{st.fairness.terminatingHash}</p>
            <p><span className="text-gray-500">Salt: </span>{st.fairness.salt}</p>
            <p><span className="text-gray-500">Formula: </span>{st.fairness.formula}</p>
          </div>
          <p className="font-bold text-white">Tap a past round to check it</p>
          <div className="flex flex-wrap gap-1.5">
            {st.history.slice(0, 15).map(h => (
              <button key={h.id} onClick={() => openProof(h.id)} className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${pointColour(h.point)}`}>{h.id} · {h.point.toFixed(2)}x</button>
            ))}
          </div>
          {proofErr && <p className="text-red-300">{proofErr}</p>}
          {proof && (
            <div className="space-y-1 rounded-xl border border-[#3EE08A]/30 bg-[#3EE08A]/5 p-3 font-mono text-[10px] break-all">
              <p className="font-sans text-xs font-extrabold text-white">{proof.p.id}</p>
              <p><span className="text-gray-500">Code shown before: </span>{proof.p.hash}</p>
              <p><span className="text-gray-500">Seed revealed: </span>{proof.p.seed}</p>
              <p className={proof.check.hashOk ? 'text-[#3EE08A]' : 'text-red-300'}>{proof.check.hashOk ? '✓ SHA-256(seed) matches the code' : '✕ seed does not match the code'}</p>
              {proof.check.pointOk !== null && (
                <p className={proof.check.pointOk ? 'text-[#3EE08A]' : 'text-red-300'}>
                  {proof.check.pointOk ? `✓ Recomputed blast point ${fmtX(proof.check.point)} matches` : `✕ Recomputed ${fmtX(proof.check.point)}, round shows ${fmtX(proof.p.point)}`}
                </p>
              )}
            </div>
          )}
        </div>
      </Sheet>
    </div>
  );
}
