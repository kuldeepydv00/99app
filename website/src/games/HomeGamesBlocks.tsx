import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { gamesGet } from './api';
import type { TradingGame } from './api';
import { clock, useServerNow } from './ui';
import MarketTile, { shortTime } from './MarketTile';

export type Lobby = {
  serverTime: number;
  trading: Record<TradingGame, { label: string; enabled: boolean; payout: number; round: { roundId: string; start: number; lock: number; end: number; status: string }; lastResult: { result: string } | null }>;
  matka99: { payout: number; haroofPayout?: number; ruleLine?: string; rules?: string[]; markets: { key: string; name: string; open: string | null; close: string | null; resultTime: string | null; enabled: boolean; isOpen: boolean; lastResult: { number: string; date: string } | null; todayResult: string | null }[] };
  jet?: { label: string; enabled: boolean; serverTime: number; growth: number; lastPoint: number | null; recent: number[];
    round: { id?: string; phase: string; bettingEndsAt?: number; flyAt?: number | null; point?: number | null } };
};

/** Polls the games lobby every 5 s while `enabled`. Returns null until the first load. */
export function useLobby(enabled = true) {
  const [lobby, setLobby] = useState<Lobby | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = () => gamesGet<Lobby>('/api/games/lobby').then(d => { if (alive) setLobby(d); }).catch(() => {});
    load();
    const id = setInterval(load, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [enabled]);
  return lobby;
}

/** Page header for a home section (Matka, 99x Matka): back arrow, title, badge, subtitle. */
export function SectionHeader({ title, badge, subtitle, onBack, right }: {
  title: string; badge?: string; subtitle?: string; onBack: () => void; right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <button onClick={onBack} aria-label="Back"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#C9A87C]/40 bg-[#0C241B] text-lg font-bold text-[#E0C9A0] transition-all hover:border-[#C9A87C] active:scale-95">←</button>
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-wide text-white">
          {title}
          {badge && <span className="rounded-full border border-[#C9A87C]/50 bg-[#C9A87C]/10 px-2 py-0.5 text-[10px] font-extrabold text-[#E0C9A0]">{badge}</span>}
        </h2>
        {subtitle && <p className="mt-0.5 text-[11px] text-gray-400">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

/** 99x Matka markets as square tiles (open first). */
export function Matka99Section({ lobby, onOpenMatka99 }: { lobby: Lobby | null; onOpenMatka99: (marketKey: string) => void }) {
  if (!lobby) return <p className="py-10 text-center text-xs font-semibold text-gray-500">Loading 99x Matka…</p>;
  const markets = lobby.matka99.markets.filter(m => m.enabled);
  const ordered = [...markets.filter(m => m.isOpen), ...markets.filter(m => !m.isOpen)];
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {ordered.map((m, i) => (
        <MarketTile
          key={m.key}
          accent="rose"
          delay={i * 50}
          icon="99x"
          name={m.name}
          sub={m.isOpen ? `Pays ${lobby.matka99.payout}x` : `Opens ${shortTime(m.open)}`}
          state={m.isOpen
            ? { kind: 'open', note: `Closes ${shortTime(m.close)}` }
            : { kind: 'closed', result: m.todayResult || null, note: shortTime(m.resultTime || m.close) }}
          onClick={() => onOpenMatka99(m.key)}
        />
      ))}
    </div>
  );
}

type BoxId = 'matka' | 'matka99' | 'jet' | TradingGame;
const BOXES: { id: BoxId; img: string; title: string }[] = [
  { id: 'matka', img: '/banners/banner_matka.webp', title: 'Play Matka' },
  { id: 'matka99', img: '/banners/banner_matka99.webp', title: 'Play 99x Matka' },
  { id: 'jet', img: '/banners/banner_jet.webp', title: 'Play 99x Jet' },
  { id: 'number', img: '/banners/banner_number.webp', title: 'Play Number Trading' },
  { id: 'card', img: '/banners/banner_card.webp', title: 'Play Card Trading' },
  { id: 'colour', img: '/banners/banner_colour.webp', title: 'Play Colour Trading' }
];

/** Home page: one big picture box per game, like a game lobby. */
export function HomeGameBoxes({ lobby, matkaOpen, matkaTotal, onOpenMatka, onOpenMatka99, onOpenTrading, onOpenJet }: {
  lobby: Lobby | null;
  matkaOpen: number;
  matkaTotal: number;
  onOpenMatka: () => void;
  onOpenMatka99: () => void;
  onOpenTrading: (game: TradingGame) => void;
  onOpenJet: () => void;
}) {
  const now = useServerNow(lobby?.serverTime);

  const info = (id: BoxId): { status: string; live: boolean; disabled?: boolean; idle?: string } => {
    if (id === 'matka') return { status: `${matkaOpen} of ${matkaTotal} markets open · results daily`, live: matkaOpen > 0 };
    if (!lobby) return { status: 'Loading…', live: false };
    if (id === 'matka99') {
      const ms = lobby.matka99.markets.filter(m => m.enabled);
      const open = ms.filter(m => m.isOpen).length;
      return { status: `${open} of ${ms.length} open · lowest-bet number wins · pays ${lobby.matka99.payout}x`, live: open > 0 };
    }
    if (id === 'jet') {
      const j = lobby.jet;
      if (!j || !j.enabled) return { status: 'Paused for now', live: false, disabled: !j };
      const last = j.lastPoint != null ? ` · last ${j.lastPoint.toFixed(2)}x` : '';
      if (j.round.phase === 'flying') return { status: `Flying now${last} · up to 2000x`, live: true };
      if (j.round.phase === 'betting' && j.round.bettingEndsAt) {
        return { status: `Next take-off in ${Math.max(0, Math.ceil((j.round.bettingEndsAt - now) / 1000))}s${last}`, live: true };
      }
      return { status: `Rounds every few seconds${last} · up to 2000x`, live: true };
    }
    const t = lobby.trading[id];
    if (!t || !t.enabled) return { status: 'Paused for now', live: false, disabled: true };
    const locked = now >= t.round.lock;
    const left = locked ? t.round.end - now : t.round.lock - now;
    return { status: `${locked ? 'Result in' : 'Betting closes in'} ${clock(left)} · pays ${t.payout}x`, live: !locked, idle: 'Result soon' };
  };

  const open = (id: BoxId) => {
    if (id === 'matka') onOpenMatka();
    else if (id === 'matka99') onOpenMatka99();
    else if (id === 'jet') onOpenJet();
    else onOpenTrading(id);
  };

  return (
    <section id="all-games" className="scroll-mt-24 px-4">
      <div className="mb-3 flex items-end justify-between">
        <h3 className="text-lg font-extrabold tracking-wide text-white">All games</h3>
        <span className="text-[11px] font-medium text-gray-500">Tap a game to play</span>
      </div>
      <div className="space-y-4">
        {BOXES.map((b, i) => {
          const s = info(b.id);
          return (
            <button key={b.id} onClick={() => open(b.id)} disabled={s.disabled} style={{ animationDelay: `${i * 70}ms` }}
              className="g-rise g-lift group block w-full overflow-hidden rounded-2xl border border-[#C9A87C]/25 bg-[#0B1712] text-left shadow-xl hover:border-[#C9A87C]/70 disabled:opacity-50">
              <div className="relative aspect-[30/17] w-full overflow-hidden bg-[#0A0F0D]">
                <img src={b.img} alt="" loading={i > 1 ? 'lazy' : 'eager'} draggable={false}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[15px] font-extrabold text-white">{b.title}</p>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${s.live ? 'bg-[#3EE08A]/15 text-[#3EE08A]' : 'bg-white/10 text-gray-300'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${s.live ? 'animate-pulse bg-[#3EE08A]' : 'bg-gray-400'}`} />
                      {s.live ? 'Live' : s.disabled ? 'Paused' : (s.idle || 'Closed')}
                    </span>
                  </div>
                  <p className="truncate text-[11px] font-medium tabular-nums text-gray-400">{s.status}</p>
                </div>
                <span className={`shrink-0 rounded-xl px-3.5 py-2 text-[11px] font-black tracking-wider text-[#0A0F0D] shadow-lg transition-transform group-hover:scale-105 ${b.id === 'matka99' ? 'bg-gradient-to-r from-[#F5EDE2] to-[#E0B7A0]' : 'bg-gradient-to-r from-[#F0DDB8] via-[#C9A87C] to-[#8A6D47]'}`}>
                  PLAY →
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
