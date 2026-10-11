import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gamesGet, gamesPost, API_BASE, everyVisible } from './api';
import { inr } from './ui';
import { GameScreen, GameBox, BetAmount, Field, PlayButton, GameFooter, NvModal, RulesList, Segmented, rupees } from './kit';
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

const multAt = (growth: number, ms: number) => (ms <= 0 ? 1 : Math.floor(Math.exp(growth * ms) * 100 + 1e-9) / 100);
const fmtX = (x: number | null | undefined) => (x == null ? '—' : `${x.toFixed(2)}x`);
const pointColour = (p: number) => (p >= 10 ? 'bg-nv-gold text-[#2A1B08]' : p >= 2 ? 'bg-nv-green text-[#05210F]' : 'bg-nv-edge text-white');


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
    <div className={`relative overflow-hidden rounded-lg bg-[radial-gradient(ellipse_at_70%_80%,#163A5A_0%,#0F2A40_45%,#0F212E_100%)] ${round.phase === 'ended' ? 'g-jet-shake' : ''}`}>
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

  const tone: 'blue' | 'green' | 'grey' = canCashOut ? 'green' : canCancel ? 'grey' : button.disabled ? 'grey' : 'blue';
  return (
    <div className="space-y-3 rounded-md bg-nv-input/40 p-3 ring-1 ring-nv-edge">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-bold text-white">Bet {slot}</span>
        {won
          ? <span className="text-[11.5px] font-semibold text-nv-green">Won {rupees(active!.win)} at {fmtX(active!.cashout)}</span>
          : active && active.status === 'lost' && inRound
            ? <span className="text-[11.5px] font-semibold text-nv-mute">Lost {rupees(active.amount, 0)}</span>
            : <div className="w-36"><Segmented options={[{ value: 'bet', label: 'Manual' }, { value: 'auto', label: 'Auto' }]} value={mode} onChange={setMode} disabled={locked} /></div>}
      </div>
      <BetAmount value={amount} onChange={setAmount} min={cfg.minBet} max={cfg.maxBet} balance={balance} disabled={locked} />
      {mode === 'auto' && (
        <Field label="Cash out at">
          <label className="flex h-11 items-center gap-2 rounded-md bg-nv-input px-3 ring-1 ring-nv-edge focus-within:ring-nv-blue2">
            <input inputMode="decimal" disabled={locked} value={auto} onChange={e => setAuto(e.target.value.replace(/[^0-9.]/g, ''))}
              className="h-full min-w-0 flex-1 bg-transparent text-[14px] font-semibold tabular-nums text-white focus:outline-none disabled:opacity-60" />
            <span className="text-[13px] font-semibold text-nv-mute">×</span>
          </label>
        </Field>
      )}
      <PlayButton tone={tone} onClick={() => button.onClick?.()} busy={busy} disabled={button.disabled}>
        <span className="flex flex-col items-center leading-tight">
          <span>{button.label === `BET ${inr(amount)}` ? `Bet ${rupees(amount, 0)}` : button.label.charAt(0) + button.label.slice(1).toLowerCase()}</span>
          {(button.sub || (pending && active!.auto)) && (
            <span className="text-[11px] font-semibold opacity-85">{button.sub}{pending && active!.auto ? `${button.sub ? ' · ' : ''}auto at ${fmtX(active!.auto)}` : ''}</span>
          )}
        </span>
      </PlayButton>
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

  useEffect(() => { loadMine(); return everyVisible(loadMine, 6000); }, [loadMine]);
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


  if (!st) {
    return (
      <GameScreen title="99x Jet" balance={balance} onBack={onBack}>
        <p className="py-24 text-center text-[13px] text-nv-mute">{error || 'Loading 99x Jet…'}</p>
      </GameScreen>
    );
  }

  const handleDone = (d: { balances?: Balances | null; text: string }) => {
    if (d.balances) balancesRef.current(d.balances);
    setMsg({ ok: true, text: d.text });
    loadMine();
  };

  return (
    <GameScreen title="99x Jet" kicker={`Crash game · up to ${st.config.maxPoint}x`} balance={balance} onBack={onBack} live={{ key: 'jet' }}>
      <GameBox
        panel={(
          <>
            <BetPanel slot={1} st={st} active={slotActive[1]} now={now} mobile={mobile} balance={balance} onDone={handleDone} onError={t => setMsg({ ok: false, text: t })} />
            <BetPanel slot={2} st={st} active={slotActive[2]} now={now} mobile={mobile} balance={balance} onDone={handleDone} onError={t => setMsg({ ok: false, text: t })} />
            <p className="text-center text-[11px] text-nv-dim">
              Max win {rupees(st.config.maxWin, 0)} per bet · {st.config.edgePct}% house edge
            </p>
          </>
        )}
        stage={(
          <div className="flex h-full flex-col gap-3 p-3 sm:p-4">
            <div className="nv-noscroll flex gap-1.5 overflow-x-auto">
              {st.history.length === 0 && <span className="text-[12px] text-nv-mute">No rounds yet</span>}
              {st.history.map(h => (
                <span key={h.id} className={`shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold tabular-nums ${pointColour(h.point)}`}>{h.point.toFixed(2)}x</span>
              ))}
            </div>
            <Flight round={st.round} config={st.config} serverNow={serverNow} />
            <div className="flex items-center justify-between gap-2 text-[11px] text-nv-dim">
              <span className="truncate font-mono">{st.round.id || '—'}</span>
              <span>{st.live.players} playing · {rupees(st.live.staked, 0)} bet</span>
            </div>
            {msg && (
              <p className={`rounded-md px-3 py-2 text-center text-[12.5px] font-semibold ${msg.ok ? 'bg-nv-green/10 text-nv-green' : 'bg-nv-red/10 text-nv-red'}`}>{msg.text}</p>
            )}
          </div>
        )}
        footer={<GameFooter name="Jet" onRules={() => setShowRules(true)} />}
      />

      {/* live bets / my bets */}
      <div className="mt-4 overflow-hidden rounded-lg bg-nv-panel ring-1 ring-white/[0.04]">
        <div className="flex gap-1 border-b border-black/30 p-2">
          {(['all', 'mine'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`nv-tap rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${tab === t ? 'bg-nv-card2 text-white' : 'text-nv-text hover:text-white'}`}>
              {t === 'all' ? `All bets · ${st.live.count}` : 'My bets'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-4 px-4 py-2 text-[12px] font-semibold text-nv-mute">
          <span>{tab === 'all' ? 'Player' : 'Round'}</span><span className="text-right">Bet</span><span className="text-right">Cash out</span><span className="text-right">Win</span>
        </div>
        {tab === 'all' ? (
          <div>
            {st.live.bets.length === 0 && <p className="px-4 pb-6 pt-2 text-center text-[13px] text-nv-mute">No bets in this round yet.</p>}
            {st.live.bets.map((b, i) => (
              <div key={i} className={`grid grid-cols-4 items-center px-4 py-2 text-[12.5px] ${i % 2 ? 'bg-nv-input/40' : ''}`}>
                <span className="truncate font-mono text-nv-text">{b.name}</span>
                <span className="text-right tabular-nums text-white">{rupees(b.amount, 0)}</span>
                <span className={`text-right font-semibold tabular-nums ${b.status === 'won' ? 'text-nv-green' : 'text-nv-dim'}`}>
                  {b.status === 'won' ? fmtX(b.cashout) : b.status === 'lost' ? 'lost' : st.round.phase === 'flying' ? 'flying' : '—'}
                </span>
                <span className={`text-right font-semibold tabular-nums ${b.status === 'won' ? 'text-nv-green' : 'text-nv-dim'}`}>{b.status === 'won' ? rupees(b.win) : '—'}</span>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {myBets.length === 0 && <p className="px-4 pb-6 pt-2 text-center text-[13px] text-nv-mute">{mobile ? 'No 99x Jet bets yet.' : 'Log in to see your bets.'}</p>}
            {myBets.slice(0, 30).map((b, i) => (
              <div key={b.id} className={`grid grid-cols-4 items-center px-4 py-2 text-[12.5px] ${i % 2 ? 'bg-nv-input/40' : ''}`}>
                <span className="truncate font-mono text-nv-mute">{b.roundId}</span>
                <span className="text-right tabular-nums text-white">{rupees(b.amount, 0)}</span>
                <span className="text-right font-semibold tabular-nums text-nv-text">
                  {b.status === 'won' ? fmtX(b.cashout) : b.status === 'lost' ? `✕ ${fmtX(b.result)}` : b.status === 'refunded' ? 'refunded' : 'open'}
                </span>
                <span className={`text-right font-semibold tabular-nums ${b.status === 'won' ? 'text-nv-green' : 'text-nv-dim'}`}>{b.status === 'won' ? `+${rupees(b.win_amount)}` : '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <NvModal open={showRules} onClose={() => setShowRules(false)} title="How 99x Jet works">
        <RulesList lines={st.rules} />
      </NvModal>
    </GameScreen>
  );
}
