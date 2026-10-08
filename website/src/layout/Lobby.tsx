import { useEffect, useRef, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import {
  Search, X, LayoutGrid, Sparkles, Crown, Gem, ChevronLeft, ChevronRight, ChartColumn, Clock
} from 'lucide-react';
import type { Lobby } from '../games/HomeGamesBlocks';
import type { TradingGame } from '../games/api';
import { clock, useServerNow } from '../games/ui';
import { shortTime } from '../games/MarketTile';
import type { HomeSection } from './Shell';

// Home lobby: promotions, search, category tabs, 99x Originals tiles and the Matka / 99x Matka markets.

export type GameId = 'matka' | 'matka99' | 'jet' | 'dice' | 'mines' | TradingGame;

/** One Matka market, worked out by App from its schedule and today's result. */
export type MarketView = {
  name: string;
  open: boolean;
  minsLeft: number;      // minutes until betting closes (when open)
  openAt: string;
  closeAt: string;
  resultAt: string;
  result: string | null; // today's declared result
};

export type Promo =
  | { id: string; kind: 'image'; src: string; alt: string; onClick?: () => void }
  | { id: string; kind: 'card'; tag: string; title: string; text: string; cta: string; art: string; tint: string; onClick: () => void };

type Game = { id: GameId; name: string; tile: string; tags: string };

export const ORIGINALS: Game[] = [
  { id: 'jet', name: '99x Jet', tile: '/tiles/tile_jet.webp', tags: 'jet crash plane aviator fly' },
  { id: 'mines', name: 'Mines', tile: '/tiles/tile_mines.webp', tags: 'mines mine gem bomb grid' },
  { id: 'dice', name: 'Dice', tile: '/tiles/tile_dice.webp', tags: 'dice roll over under' },
  { id: 'dragontiger', name: 'Dragon Tiger', tile: '/tiles/tile_dragontiger.webp', tags: 'dragon tiger dt tie' },
  { id: 'toss', name: 'Toss', tile: '/tiles/tile_toss.webp', tags: 'toss coin head tail flip' },
  { id: 'colour', name: 'Colour Trading', tile: '/tiles/tile_colour.webp', tags: 'colour color red blue green trading' },
  { id: 'number', name: 'Number Trading', tile: '/tiles/tile_number.webp', tags: 'number numbers trading 00 99' },
  { id: 'card', name: 'Card Trading', tile: '/tiles/tile_card.webp', tags: 'card cards trading 52' },
  { id: 'matka99', name: '99x Matka', tile: '/tiles/tile_matka99.webp', tags: '99x matka fixed jodi haroof' }
];
const MATKA_GAME: Game = { id: 'matka', name: 'Matka', tile: '/tiles/tile_matka.webp', tags: 'matka satta jodi haroof crossing markets' };

type Status = { text: string; live: boolean; disabled?: boolean };

function gameStatus(id: GameId, lobby: Lobby | null, now: number, matkaOpen: number, matkaTotal: number): Status {
  if (id === 'matka') return { text: `${matkaOpen} of ${matkaTotal} open`, live: matkaOpen > 0 };
  if (!lobby) return { text: 'Loading…', live: false };
  if (id === 'matka99') {
    const ms = lobby.matka99.markets.filter(m => m.enabled);
    const open = ms.filter(m => m.isOpen).length;
    return { text: `${open} of ${ms.length} open`, live: open > 0 };
  }
  if (id === 'dice' || id === 'mines') {
    const g = lobby.instant?.[id];
    if (!g) return { text: 'Instant play', live: true };
    return g.enabled ? { text: 'Instant play', live: true } : { text: 'Paused', live: false, disabled: true };
  }
  if (id === 'jet') {
    const j = lobby.jet;
    if (!j || !j.enabled) return { text: 'Paused', live: false, disabled: !j };
    if (j.round.phase === 'flying') return { text: 'Flying now', live: true };
    if (j.round.phase === 'betting' && j.round.bettingEndsAt) {
      return { text: `Take-off ${Math.max(0, Math.ceil((j.round.bettingEndsAt - now) / 1000))}s`, live: true };
    }
    return { text: 'Live', live: true };
  }
  const t = lobby.trading[id];
  if (!t || !t.enabled) return { text: 'Paused', live: false, disabled: true };
  const locked = now >= t.round.lock;
  const left = locked ? t.round.end - now : t.round.lock - now;
  return { text: `${locked ? 'Result' : 'Closes'} ${clock(left)}`, live: !locked };
}

const HUES = ['#1D6FE8', '#E0457B', '#14B8A6', '#F59E0B', '#8B5CF6', '#22C55E', '#EF4444', '#06B6D4'];
const initials = (name: string) => {
  const w = name.trim().split(/\s+/);
  return ((w[0]?.[0] || '') + (w[1]?.[0] || w[0]?.[1] || '')).toUpperCase();
};

/* ---------------- small pieces ---------------- */

/** Horizontal row that scrolls by swipe on phones and by arrow buttons on bigger screens. */
function Scroller({ children, className = '', arrowsTop = '50%' }: { children: ReactNode; className?: string; arrowsTop?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const touched = useRef(false); // the person has scrolled this row themselves
  const update = () => {
    const el = ref.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  };
  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    // A picture that loads late (an admin banner) changes the row's width and the browser re-snaps to a
    // later card. Until the person scrolls the row themselves, keep it at the start.
    const onLoad = () => { if (!touched.current) el.scrollLeft = 0; update(); };
    const onTouch = () => { touched.current = true; };
    el.addEventListener('load', onLoad, true);
    el.addEventListener('pointerdown', onTouch);
    el.addEventListener('wheel', onTouch, { passive: true });
    el.addEventListener('touchstart', onTouch, { passive: true });
    return () => {
      ro?.disconnect();
      el.removeEventListener('load', onLoad, true);
      el.removeEventListener('pointerdown', onTouch);
      el.removeEventListener('wheel', onTouch);
      el.removeEventListener('touchstart', onTouch);
    };
  }, []);
  const go = (dir: number) => {
    touched.current = true;
    ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' });
  };
  const arrow = (dir: number, hidden: boolean) => (
    <button aria-label={dir < 0 ? 'Scroll left' : 'Scroll right'} onClick={() => go(dir)}
      style={{ top: arrowsTop }}
      className={`absolute z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-nv-card2/95 text-white shadow-lg ring-1 ring-white/10 transition hover:bg-nv-line md:flex ${dir < 0 ? '-left-3' : '-right-3'} ${hidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
      {dir < 0 ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
    </button>
  );
  return (
    <div className="relative">
      <div ref={ref} onScroll={update} className={`nv-noscroll -mx-4 flex snap-x snap-mandatory overflow-x-auto scroll-px-4 px-4 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:scroll-px-0 lg:px-0 ${className}`}>
        {children}
      </div>
      {arrow(-1, edge.start)}
      {arrow(1, edge.end)}
    </div>
  );
}

function SectionHead({ icon: Icon, title, sub, onAll, right }: {
  icon: ComponentType<{ className?: string }>; title: string; sub?: string; onAll?: () => void; right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-[18px] w-[18px] shrink-0 text-nv-mute" />
      <h2 className="text-[15px] font-semibold text-white sm:text-base">{title}</h2>
      {sub && <span className="hidden truncate text-[12px] text-nv-mute sm:inline">· {sub}</span>}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {right}
        {onAll && (
          <button onClick={onAll} className="nv-tap rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-nv-text transition-colors hover:bg-nv-card2 hover:text-white">
            View all
          </button>
        )}
      </div>
    </div>
  );
}

function GameTile({ g, st, onClick, eager }: { g: Game; st: Status; onClick: () => void; eager?: boolean }) {
  return (
    <button onClick={onClick} disabled={st.disabled} aria-label={`Play ${g.name}`} className="nv-tap group block w-full text-left disabled:opacity-60">
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-nv-card shadow-[0_6px_16px_rgba(0,0,0,0.35)] ring-1 ring-white/5 transition-transform duration-200 ease-out group-hover:-translate-y-1.5 group-active:scale-[0.97]">
        <img src={g.tile} alt={g.name} loading={eager ? 'eager' : 'lazy'} draggable={false} className="h-full w-full object-cover" />
        {st.disabled && <span className="absolute left-1/2 top-2 -translate-x-1/2 rounded bg-black/75 px-2 py-0.5 text-[10px] font-semibold text-white">Paused</span>}
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium tabular-nums text-nv-mute sm:text-[12px]">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.live ? 'bg-nv-green shadow-[0_0_6px_#1FD65F]' : 'bg-nv-dim'}`} />
        <span className="truncate">{st.text}</span>
      </p>
    </button>
  );
}

function StatusPill({ kind, text }: { kind: 'open' | 'soon' | 'closed'; text: string }) {
  const cls = kind === 'open' ? 'bg-nv-green/15 text-nv-green' : kind === 'soon' ? 'bg-amber-400/15 text-amber-300' : 'bg-white/[0.07] text-nv-mute';
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${cls}`}>
      {kind !== 'closed' && <span className={`h-1.5 w-1.5 rounded-full ${kind === 'open' ? 'animate-pulse bg-nv-green' : 'bg-amber-300'}`} />}
      {text}
    </span>
  );
}

function MarketCard({ name, badge, hue, time, pill, result, resultAt, open, onClick }: {
  name: string; badge: string; hue: string; time: string; pill: { kind: 'open' | 'soon' | 'closed'; text: string };
  result: string | null; resultAt: string; open: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="nv-tap group flex min-w-0 flex-col rounded-lg bg-nv-card p-3 text-left ring-1 ring-white/[0.03] transition-colors hover:bg-nv-card2">
      <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
        <span className="flex h-8 w-8 shrink-0 sm:h-9 sm:w-9 items-center justify-center rounded-md text-[12px] font-bold text-white shadow-inner"
          style={{ background: `linear-gradient(135deg, ${hue}, ${hue}80)` }}>{badge}</span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold text-white">{name}</span>
          <span className="block truncate text-[11px] text-nv-mute">{time}</span>
        </span>
      </div>
      <div className="mt-2.5 flex min-w-0 items-center justify-between gap-1.5">
        <StatusPill {...pill} />
        {result
          ? <span className="truncate text-[11px] text-nv-mute">Result <b className="ml-0.5 font-bold tabular-nums text-white">{result}</b></span>
          : <span className="inline-flex min-w-0 items-center gap-1 truncate text-[11px] tabular-nums text-nv-mute"><Clock className="h-3 w-3 shrink-0" />{resultAt}</span>}
      </div>
      <span className={`mt-2.5 flex h-8 items-center justify-center rounded-md text-[12px] font-semibold transition-colors ${open ? 'bg-nv-blue text-white group-hover:bg-nv-blue2' : 'bg-nv-card2 text-nv-text group-hover:bg-nv-line group-hover:text-white'}`}>
        {open ? 'Play now' : 'View'}
      </span>
    </button>
  );
}

const GRID = 'grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4';

function MatkaGrid({ markets, onPlay, limit }: { markets: MarketView[]; onPlay: (name: string) => void; limit?: number }) {
  const list = [...markets.filter(m => m.open), ...markets.filter(m => !m.open)].slice(0, limit ?? markets.length);
  return (
    <div className={GRID}>
      {list.map(m => {
        const soon = m.open && m.minsLeft > 0 && m.minsLeft <= 30;
        const i = Math.max(0, markets.findIndex(x => x.name === m.name));
        return (
          <MarketCard key={m.name} name={m.name} badge={initials(m.name)} hue={HUES[i % HUES.length]}
            time={m.open ? `Closes ${shortTime(m.closeAt)}` : `Opens ${shortTime(m.openAt)}`}
            pill={m.open ? (soon ? { kind: 'soon', text: `${m.minsLeft}m left` } : { kind: 'open', text: 'Open' }) : { kind: 'closed', text: 'Closed' }}
            result={m.result} resultAt={shortTime(m.resultAt)} open={m.open} onClick={() => onPlay(m.name)} />
        );
      })}
    </div>
  );
}

function Matka99Grid({ lobby, onOpen, limit }: { lobby: Lobby | null; onOpen: (key: string) => void; limit?: number }) {
  if (!lobby) return <p className="py-8 text-center text-[13px] text-nv-mute">Loading 99x Matka…</p>;
  const ms = lobby.matka99.markets.filter(m => m.enabled);
  const list = [...ms.filter(m => m.isOpen), ...ms.filter(m => !m.isOpen)].slice(0, limit ?? ms.length);
  if (!list.length) return <p className="rounded-lg bg-nv-card py-8 text-center text-[13px] text-nv-mute">No 99x Matka markets right now.</p>;
  return (
    <div className={GRID}>
      {list.map(m => (
        <MarketCard key={m.key} name={m.name} badge="99x" hue="#E0457B"
          time={m.isOpen ? `Closes ${shortTime(m.close)}` : `Opens ${shortTime(m.open)}`}
          pill={m.isOpen ? { kind: 'open', text: 'Open' } : { kind: 'closed', text: 'Closed' }}
          result={m.todayResult || null} resultAt={shortTime(m.resultTime || m.close)} open={m.isOpen} onClick={() => onOpen(m.key)} />
      ))}
    </div>
  );
}

function PromoCard({ p }: { p: Promo }) {
  const [broken, setBroken] = useState(false);
  if (p.kind === 'image') {
    // Admin banners are posters with their own text: show the whole picture at the row's height, never cropped
    if (broken) return null;
    return (
      <button onClick={p.onClick} className="nv-tap block h-full overflow-hidden rounded-lg bg-nv-card ring-1 ring-white/5">
        <img src={p.src} alt={p.alt} draggable={false} className="block h-full w-auto max-w-none object-cover"
          style={{ maxWidth: 'min(86vw, 640px)' }} onError={() => setBroken(true)} />
      </button>
    );
  }
  return (
    <button onClick={p.onClick}
      className="nv-tap group relative flex h-full w-full overflow-hidden rounded-lg text-left ring-1 ring-white/5"
      style={{ background: `linear-gradient(100deg, #1A2A36 0%, #1A2A36 42%, ${p.tint} 135%)` }}>
      <div className="relative z-10 flex w-[62%] flex-col items-start justify-center p-4">
        <span className="rounded bg-white px-1.5 py-[3px] text-[10px] font-bold uppercase leading-none tracking-wide text-nv-bg">{p.tag}</span>
        <p className="mt-2 text-[16px] font-bold leading-tight text-white">{p.title}</p>
        <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-nv-text">{p.text}</p>
        <span className="mt-3 rounded-md border border-white/25 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors group-hover:border-white/50 group-hover:bg-white/10">{p.cta}</span>
      </div>
      <img src={p.art} alt="" draggable={false} className="absolute right-0 top-1/2 h-[80%] max-w-[46%] -translate-y-1/2 object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:scale-105" />
    </button>
  );
}

const TABS: { key: HomeSection; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { key: null, label: 'Lobby', icon: LayoutGrid },
  { key: 'originals', label: 'Originals', icon: Sparkles },
  { key: 'matka', label: 'Matka', icon: Crown },
  { key: 'matka99', label: '99x Matka', icon: Gem }
];

/* ---------------- the lobby ---------------- */

export default function HomeLobby({ lobby, section, onSection, markets, onPlayMarket, onOpenMatka99, onOpenGame, onMatka99Chart, promos }: {
  lobby: Lobby | null;
  section: HomeSection;
  onSection: (s: HomeSection) => void;
  markets: MarketView[];
  onPlayMarket: (name: string) => void;
  onOpenMatka99: (key: string) => void;
  onOpenGame: (id: GameId) => void;
  onMatka99Chart: () => void;
  promos: Promo[];
}) {
  const now = useServerNow(lobby?.serverTime);
  const [q, setQ] = useState('');
  const matkaOpen = markets.filter(m => m.open).length;
  const status = (id: GameId) => gameStatus(id, lobby, now, matkaOpen, markets.length);
  const query = q.trim().toLowerCase();

  const tile = (g: Game, i: number) => (
    <GameTile key={g.id} g={g} st={status(g.id)} eager={i < 4} onClick={() => onOpenGame(g.id)} />
  );

  // search results
  let results: ReactNode = null;
  if (query) {
    const games = [MATKA_GAME, ...ORIGINALS].filter(g => (g.name + ' ' + g.tags).toLowerCase().includes(query));
    const mk = markets.filter(m => m.name.toLowerCase().includes(query));
    const m99 = lobby ? lobby.matka99.markets.filter(m => m.enabled && m.name.toLowerCase().includes(query)) : [];
    results = (
      <div className="space-y-8">
        {games.length > 0 && (
          <section>
            <SectionHead icon={Sparkles} title="Games" />
            <div className="grid grid-cols-3 gap-x-2.5 gap-y-4 pt-1.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">{games.map(tile)}</div>
          </section>
        )}
        {mk.length > 0 && (
          <section>
            <SectionHead icon={Crown} title="Matka markets" />
            <MatkaGrid markets={mk} onPlay={onPlayMarket} />
          </section>
        )}
        {m99.length > 0 && (
          <section>
            <SectionHead icon={Gem} title="99x Matka markets" />
            <div className={GRID}>
              {m99.map(m => (
                <MarketCard key={m.key} name={m.name} badge="99x" hue="#E0457B"
                  time={m.isOpen ? `Closes ${shortTime(m.close)}` : `Opens ${shortTime(m.open)}`}
                  pill={m.isOpen ? { kind: 'open', text: 'Open' } : { kind: 'closed', text: 'Closed' }}
                  result={m.todayResult || null} resultAt={shortTime(m.resultTime || m.close)} open={m.isOpen} onClick={() => onOpenMatka99(m.key)} />
              ))}
            </div>
          </section>
        )}
        {!games.length && !mk.length && !m99.length && (
          <div className="rounded-lg bg-nv-card px-4 py-12 text-center">
            <Search className="mx-auto h-7 w-7 text-nv-dim" />
            <p className="mt-3 text-sm font-semibold text-white">No games found</p>
            <p className="mt-1 text-[13px] text-nv-mute">Try "matka", "jet" or a market name.</p>
          </div>
        )}
      </div>
    );
  }

  const m99Open = lobby ? lobby.matka99.markets.filter(m => m.enabled && m.isOpen).length : 0;
  const m99All = lobby ? lobby.matka99.markets.filter(m => m.enabled).length : 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* promotions */}
      {!section && !query && promos.length > 0 && (
        <Scroller className="nv-promos gap-3">
          {promos.map(p => (
            <div key={p.id} className={`h-[164px] snap-start sm:h-[176px] ${p.kind === 'image' ? 'nv-promo-img' : ''}`}>
              <PromoCard p={p} />
            </div>
          ))}
        </Scroller>
      )}

      {/* search + tabs */}
      <div className="space-y-4">
        <label className="flex h-11 items-center gap-2.5 rounded-full bg-nv-side px-4 ring-1 ring-nv-line/80 transition focus-within:ring-nv-blue2/70">
          <Search className="h-[18px] w-[18px] shrink-0 text-nv-mute" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search games and markets"
            className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-white placeholder:text-nv-dim focus:outline-none" />
          {q && (
            <button onClick={() => setQ('')} aria-label="Clear search" className="nv-tap rounded-full p-1 text-nv-mute hover:text-white">
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
        {!query && (
          <div className="nv-noscroll -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="inline-flex gap-1 rounded-full bg-nv-side p-1 ring-1 ring-nv-line/50">
              {TABS.map(t => {
                const on = section === t.key;
                const Icon = t.icon;
                return (
                  <button key={t.label} onClick={() => onSection(t.key)}
                    className={`nv-tap flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-[12.5px] font-semibold transition-colors sm:px-4 sm:text-[13px] ${on ? 'bg-nv-card2 text-white shadow' : 'text-nv-text hover:text-white'}`}>
                    <Icon className={`hidden h-4 w-4 sm:block ${on ? 'text-white' : 'text-nv-mute'}`} />{t.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {query ? results : (
        <>
          {/* LOBBY */}
          {!section && (
            <>
              <section>
                <SectionHead icon={Sparkles} title="99x Originals" sub="instant games, live every minute" onAll={() => onSection('originals')} />
                <Scroller className="nv-tiles gap-2.5 pt-2" arrowsTop="42%">
                  {ORIGINALS.map((g, i) => (
                    <div key={g.id} className="snap-start">
                      {tile(g, i)}
                    </div>
                  ))}
                </Scroller>
              </section>
              <section>
                <SectionHead icon={Crown} title="Matka" sub={`${matkaOpen} of ${markets.length} markets open`} onAll={() => onSection('matka')} />
                <MatkaGrid markets={markets} onPlay={onPlayMarket} />
              </section>
              <section>
                <SectionHead icon={Gem} title="99x Matka" sub={`fixed ${lobby?.matka99.payout ?? 99}x payout`} onAll={() => onSection('matka99')} />
                <Matka99Grid lobby={lobby} onOpen={onOpenMatka99} limit={4} />
              </section>
            </>
          )}

          {/* ORIGINALS */}
          {section === 'originals' && (
            <section>
              <SectionHead icon={Sparkles} title="99x Originals" sub={`${ORIGINALS.length} games`} />
              <div className="grid grid-cols-3 gap-x-2.5 gap-y-4 pt-1.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
                {ORIGINALS.map(tile)}
              </div>
            </section>
          )}

          {/* MATKA */}
          {section === 'matka' && (
            <section>
              <SectionHead icon={Crown} title="Matka" sub="tap a market to play" />
              <p className="-mt-1 mb-4 text-[12px] text-nv-mute sm:hidden">{matkaOpen} of {markets.length} markets open · results daily</p>
              <MatkaGrid markets={markets} onPlay={onPlayMarket} />
            </section>
          )}

          {/* 99x MATKA */}
          {section === 'matka99' && (
            <section>
              <SectionHead icon={Gem} title="99x Matka" sub={`${m99Open} of ${m99All} open`}
                right={(
                  <button onClick={onMatka99Chart} className="nv-tap inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-nv-text transition-colors hover:bg-nv-card2 hover:text-white">
                    <ChartColumn className="h-4 w-4" />Chart
                  </button>
                )} />
              <div className="mb-4 rounded-lg bg-nv-card px-3.5 py-3 text-[12px] leading-relaxed text-nv-text ring-1 ring-white/[0.03]">
                <span className="block font-semibold text-white">Jodi pays {lobby?.matka99.payout ?? 99}x · Haroof pays {lobby?.matka99.haroofPayout ?? 9.9}x</span>
                <span className="block text-nv-mute">{lobby?.matka99.ruleLine || 'The number with the lowest total bet wins.'}</span>
              </div>
              <Matka99Grid lobby={lobby} onOpen={onOpenMatka99} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
