import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Users, Trophy, Radio } from 'lucide-react';
import { gamesGet, gamesPost } from './api';

// Live players and the live bets feed.
// Counts are real: logged-in players with that game or market open right now (each account once).
// Below the admin's cut-off the server sends no number and we show a green "Live" dot instead.

export type LiveCounts = { enabled: boolean; minShow: number; total: number | null; counts: Record<string, number> };

let current: LiveCounts | null = null;
const subs = new Set<() => void>();
function setCounts(c: LiveCounts) { current = c; subs.forEach(f => f()); }
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export function useLiveCounts(): LiveCounts | null {
  return useSyncExternalStore(subscribe, () => current, () => current);
}

const hasToken = () => { try { return !!localStorage.getItem('99x_web_token'); } catch { return false; } };
const PING_MS = 15000;

/**
 * Tells the server where this player is (every 15 s, and at once when it changes) and keeps the
 * counts fresh. `where`: 'lobby', a game key ('dice', 'jet', …), 'matka:<market>' or 'matka99:<key>'.
 * Pauses while the tab is hidden, so a player in a background tab drops off after 45 s.
 */
export function useLivePresence(where: string | null, active = true) {
  useEffect(() => {
    if (!active) return;
    let stop = false;
    let seq = 0;
    let timer: number | undefined;
    const run = async (my: number) => {
      if (stop || my !== seq) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const r = where && hasToken()
          ? await gamesPost<LiveCounts>('/api/games/live/ping', { where, platform: 'web' })
          : await gamesGet<LiveCounts>('/api/games/live');
        if (!stop) setCounts({ enabled: !!r.enabled, minShow: r.minShow, total: r.total ?? null, counts: r.counts || {} });
      } catch { /* keep the last numbers */ }
      if (!stop && my === seq) timer = window.setTimeout(() => run(my), PING_MS);
    };
    const kick = () => { seq += 1; window.clearTimeout(timer); run(seq); };
    const onVis = () => { if (document.visibilityState === 'visible') kick(); };
    kick();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop = true; window.clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); };
  }, [where, active]);
}

const fmt = (n: number) => n.toLocaleString('en-IN');
const rupees = (n: number | null | undefined, dp = 2) =>
  `₹${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;

/** "● 24 playing", or "● Live" when the number is below the cut-off. Nothing when the admin switched it off. */
export function LiveCount({ k, variant = 'text', className = '', word = 'playing', showLive = true }: {
  k: string; variant?: 'text' | 'pill' | 'chip'; className?: string; word?: string; showLive?: boolean;
}) {
  const c = useLiveCounts();
  if (!c || !c.enabled) return null;
  const n = c.counts[k];
  if (n == null && !showLive) return null;
  const label = n != null ? `${fmt(n)}${word ? ` ${word}` : ''}` : 'Live';
  const dot = <span className="relative flex h-1.5 w-1.5 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-nv-green opacity-60" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-nv-green" /></span>;
  if (variant === 'pill') {
    return (
      <span className={`inline-flex items-center gap-1 rounded bg-black/65 px-1.5 py-[3px] text-[10px] font-semibold tabular-nums leading-none text-white backdrop-blur-sm ${className}`}>
        {dot}{n != null ? <><Users className="h-3 w-3 text-white/80" />{fmt(n)}</> : 'Live'}
      </span>
    );
  }
  if (variant === 'chip') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-nv-green/10 px-2.5 py-1 text-[11.5px] font-semibold tabular-nums text-nv-green ring-1 ring-nv-green/25 ${className}`}>
        {dot}{label}
      </span>
    );
  }
  return <span className={`inline-flex items-center gap-1.5 tabular-nums text-nv-green ${className}`}>{dot}{label}</span>;
}

/** Players online across the whole site (hidden below the cut-off). */
export function LiveTotal({ className = '' }: { className?: string }) {
  const c = useLiveCounts();
  if (!c || !c.enabled || c.total == null) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-nv-green/10 px-2.5 py-1 text-[11.5px] font-semibold tabular-nums text-nv-green ring-1 ring-nv-green/25 ${className}`}>
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-nv-green" />{fmt(c.total)} online
    </span>
  );
}

/* ---------------- live bets feed ---------------- */

export type FeedEntry = {
  id: string; game: string; gameLabel: string; market: string | null; player: string;
  amount: number; picks: number; detail: string; status: 'won' | 'lost' | 'pending';
  multiplier: number | null; payout: number | null; at: string;
};
type FeedResp = { feed: boolean; latest: FeedEntry[]; bigWins: FeedEntry[] };

const THUMB: Record<string, string> = {
  jet: 'tile_jet', mines: 'tile_mines', dice: 'tile_dice', dragontiger: 'tile_dragontiger', toss: 'tile_toss',
  colour: 'tile_colour', number: 'tile_number', card: 'tile_card', matka99: 'tile_matka99', matka: 'tile_matka'
};

const timeOf = (at: string) => {
  try { return new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }); }
  catch { return ''; }
};

function nameOf(e: FeedEntry) {
  if (e.game === 'matka' || e.game === 'matka99') return { main: e.market || e.gameLabel, sub: e.gameLabel };
  return { main: e.gameLabel, sub: e.detail };
}

function Payout({ e }: { e: FeedEntry }) {
  if (e.status === 'pending') return <span className="font-semibold text-amber-300">In play</span>;
  if (e.status === 'won') return <span className="font-semibold text-nv-green">+{rupees(e.payout)}</span>;
  return <span className="text-nv-dim">-{rupees(e.amount)}</span>;
}

const mult = (e: FeedEntry) => (e.multiplier == null ? '—' : `${e.multiplier.toFixed(2)}×`);

/**
 * Live bets under a game, a market or the lobby: "Latest bets" and "Big wins" (last 2 days).
 * game: a game key, 'matka' or 'matka99' (with market), or nothing for every game.
 */
export function LiveBets({ game, market, title = 'Live bets', className = '', rows: shown = 10 }: { game?: string; market?: string | null; title?: string; className?: string; rows?: number }) {
  const [tab, setTab] = useState<'latest' | 'wins'>('latest');
  const [more, setMore] = useState(false);
  const [data, setData] = useState<FeedResp | null>(null);
  const [err, setErr] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const fresh = useRef<Set<string>>(new Set());

  useEffect(() => {
    let stop = false;
    let timer: number | undefined;
    seen.current = null;
    const q = `/api/games/live/feed?game=${encodeURIComponent(game || '')}&market=${encodeURIComponent(market || '')}`;
    const run = async () => {
      if (stop) return;
      if (document.visibilityState !== 'hidden') {
        try {
          const r = await gamesGet<FeedResp>(q);
          if (stop) return;
          const ids = new Set(r.latest.map(e => e.id));
          fresh.current = new Set(seen.current ? r.latest.filter(e => !seen.current!.has(e.id)).map(e => e.id) : []);
          seen.current = ids;
          setData(r); setErr(false);
        } catch { if (!stop) setErr(true); }
      }
      if (!stop) timer = window.setTimeout(run, 5000);
    };
    run();
    return () => { stop = true; window.clearTimeout(timer); };
  }, [game, market]);

  if (data && !data.feed) return null;
  if (!data && err) return null; // server not updated yet or offline: show nothing rather than an error box
  const all = data ? (tab === 'latest' ? data.latest : data.bigWins) : [];
  const rows = more ? all : all.slice(0, shown);
  const empty = tab === 'latest' ? 'No bets yet. New bets show here as they are placed.' : 'No big wins in the last 2 days.';

  return (
    <section className={`overflow-hidden rounded-lg bg-nv-panel ring-1 ring-white/[0.04] ${className}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-black/30 px-3 py-2.5 sm:px-4">
        <Radio className="h-4 w-4 shrink-0 text-nv-green" />
        <h3 className="mr-auto truncate text-[14px] font-semibold text-white">{title}</h3>
        <div className="flex rounded-full bg-nv-input p-1 ring-1 ring-nv-edge">
          {([['latest', 'Latest bets'], ['wins', 'Big wins']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`nv-tap flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${tab === k ? 'bg-nv-card2 text-white shadow' : 'text-nv-text hover:text-white'}`}>
              {k === 'wins' && <Trophy className="h-3.5 w-3.5 text-nv-gold" />}{l}
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <p className="px-4 py-8 text-center text-[13px] text-nv-mute">Loading live bets…</p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-nv-mute">{empty}</p>
      ) : (
        <div>
          <div className="nv-feed px-3 py-2 text-[11.5px] font-semibold text-nv-mute sm:px-4">
            <span>Game</span>
            <span className="hidden sm:block">Player</span>
            <span className="hidden sm:block">Time</span>
            <span className="hidden text-right sm:block">Bet</span>
            <span className="hidden text-right sm:block">Multiplier</span>
            <span className="text-right">Payout</span>
          </div>
          {rows.map((e, i) => {
            const n = nameOf(e);
            return (
              <div key={`${tab}-${e.id}`}
                className={`nv-feed px-3 py-2 text-[12.5px] sm:px-4 ${i % 2 ? 'bg-nv-input/40' : ''} ${tab === 'latest' && fresh.current.has(e.id) ? 'nv-fade' : ''}`}>
                <span className="flex min-w-0 items-center gap-2.5">
                  <img src={`/tiles/${THUMB[e.game] || 'tile_matka'}.webp`} alt="" loading="lazy" draggable={false}
                    className="h-8 w-6 shrink-0 rounded object-cover ring-1 ring-white/10" />
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate font-semibold text-white">{n.main}</span>
                    <span className="block truncate text-[11px] text-nv-mute">
                      <span className="sm:hidden">{e.player} · {rupees(e.amount, 0)}</span>
                      <span className="hidden sm:inline">{n.sub}</span>
                    </span>
                  </span>
                </span>
                <span className="hidden truncate font-mono text-[12px] text-nv-text sm:block">{e.player}</span>
                <span className="hidden tabular-nums text-nv-mute sm:block">{timeOf(e.at)}</span>
                <span className="hidden text-right tabular-nums text-white sm:block">{rupees(e.amount)}</span>
                <span className="hidden text-right tabular-nums text-nv-text sm:block">{mult(e)}</span>
                <span className="text-right tabular-nums leading-tight">
                  <Payout e={e} />
                  <span className="block text-[11px] text-nv-mute sm:hidden">{e.status === 'pending' ? timeOf(e.at) : mult(e)}</span>
                </span>
              </div>
            );
          })}
          {all.length > shown && (
            <button onClick={() => setMore(m => !m)}
              className="nv-tap block w-full border-t border-black/30 py-2.5 text-center text-[12.5px] font-semibold text-nv-text transition-colors hover:bg-nv-card2 hover:text-white">
              {more ? 'Show less' : `Show more (${all.length - shown})`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
