import { useEffect, useState } from 'react';
import { gamesGet } from './api';
import type { TradingGame } from './api';
import { clock, useServerNow, OptionTag, COLOURS } from './ui';

type Lobby = {
  serverTime: number;
  trading: Record<TradingGame, { label: string; enabled: boolean; payout: number; round: { roundId: string; start: number; lock: number; end: number; status: string }; lastResult: { result: string } | null }>;
  matka99: { payout: number; markets: { key: string; name: string; open: string | null; close: string | null; resultTime: string | null; enabled: boolean; isOpen: boolean; lastResult: { number: string; date: string } | null; todayResult: string | null }[] };
};

const TILE: Record<TradingGame, { title: string; blurb: string; accent: string }> = {
  number: { title: 'Number', blurb: '00–99 · hourly', accent: 'from-[#3EE08A]/25' },
  card: { title: 'Card', blurb: '52 cards · hourly', accent: 'from-[#F0DDB8]/25' },
  colour: { title: 'Colour', blurb: '3 colours · 1 min', accent: 'from-[#3D8BFF]/25' }
};

export default function HomeGamesBlocks({ onOpenMatka99, onOpenTrading, onOpenChart99 }: {
  onOpenMatka99: (marketKey: string) => void;
  onOpenTrading: (game: TradingGame) => void;
  onOpenChart99?: () => void;
}) {
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => gamesGet<Lobby>('/api/games/lobby')
      .then(d => { if (alive) { setLobby(d); setFailed(false); } })
      .catch(() => { if (alive) setFailed(true); });
    load();
    const id = setInterval(load, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const now = useServerNow(lobby?.serverTime);

  if (!lobby) {
    return (
      <div className="px-4 py-6 text-center text-xs font-semibold text-gray-500">
        {failed ? 'New games are unavailable right now.' : 'Loading 99x Matka and Trading…'}
      </div>
    );
  }

  const markets = lobby.matka99.markets.filter(m => m.enabled);
  const openMarkets = markets.filter(m => m.isOpen);
  const closedMarkets = markets.filter(m => !m.isOpen);

  return (
    <div className="space-y-7 px-4">
      {/* ---------------- 99x MATKA ---------------- */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-extrabold tracking-wide">
              <span className="g-shimmer">99x Matka</span>
              <span className="rounded-full border border-[#E0B7A0]/60 bg-[#E0B7A0]/10 px-2 py-0.5 text-[10px] font-extrabold text-[#F5EDE2]">FIXED 99x</span>
            </h3>
            <p className="mt-0.5 text-[11px] text-gray-400">Same markets, new names. Every winning Jodi pays 99x.</p>
          </div>
          {onOpenChart99 && (
            <button onClick={onOpenChart99} className="text-[11px] font-bold text-[#E0C9A0] hover:text-white">Chart ›</button>
          )}
        </div>

        {openMarkets.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-[#0C241B] py-5 text-center text-xs font-semibold text-gray-400">
            No 99x market is open right now.
          </div>
        ) : (
          <div className="space-y-3">
            {openMarkets.map((m, i) => (
              <button key={m.key} onClick={() => onOpenMatka99(m.key)} style={{ animationDelay: `${i * 60}ms` }}
                className="g-rise g-lift group relative flex w-full items-center justify-between overflow-hidden rounded-2xl border border-[#E0B7A0]/40 bg-gradient-to-br from-[#1A2A22] to-[#0A0F0D] p-4 text-left shadow-xl hover:border-[#E0B7A0]/80">
                <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#E0B7A0]/10 blur-2xl" />
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#E0B7A0]/60 bg-gradient-to-br from-[#2A2320] to-[#0A0F0D] text-sm font-extrabold text-[#F5EDE2] shadow-inner">99x</div>
                  <div>
                    <h4 className="text-base font-bold text-white">{m.name}</h4>
                    <p className="mt-0.5 text-[11px] font-medium text-gray-400">Closes {m.close} · pays 99x</p>
                    <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-[#3EE08A]/40 bg-[#3EE08A]/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#3EE08A]">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3EE08A]" />Betting open
                    </span>
                  </div>
                </div>
                <span className="rounded-xl bg-gradient-to-r from-[#F5EDE2] to-[#E0B7A0] px-4 py-2.5 text-sm font-extrabold text-[#0A0F0D] shadow-lg transition-transform group-hover:scale-105">PLAY →</span>
              </button>
            ))}
          </div>
        )}

        {closedMarkets.length > 0 && (
          <div className="g-noscroll -mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1">
            {closedMarkets.map(m => {
              const res = m.todayResult || m.lastResult?.number || null;
              return (
                <div key={m.key} className="min-w-[132px] snap-start rounded-xl border border-gray-800 bg-[#0C241B] px-3 py-2.5">
                  <p className="truncate text-[11px] font-bold text-white">{m.name}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    {res ? <OptionTag game="number" value={res} /> : <span className="text-[10px] font-extrabold uppercase text-amber-400">Pending</span>}
                    <span className="text-[9px] text-gray-500">{m.resultTime || m.close}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ---------------- TRADING ---------------- */}
      <section className="space-y-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-extrabold tracking-wide text-white">
            Trading <span className="rounded-full bg-[#3EE08A]/15 px-2 py-0.5 text-[10px] font-extrabold text-[#3EE08A]">NEW</span>
          </h3>
          <p className="mt-0.5 text-[11px] text-gray-400">Quick rounds. Lowest total bet wins each round.</p>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {(['number', 'card', 'colour'] as TradingGame[]).map((g, i) => {
            const t = lobby.trading[g];
            const r = t.round;
            const locked = now >= r.lock;
            const left = locked ? r.end - now : r.lock - now;
            const last = t.lastResult?.result || null;
            return (
              <button key={g} disabled={!t.enabled} onClick={() => onOpenTrading(g)} style={{ animationDelay: `${i * 70}ms` }}
                className={`g-rise g-lift relative flex flex-col items-center overflow-hidden rounded-2xl border border-[#C9A87C]/25 bg-gradient-to-b ${TILE[g].accent} to-[#0A0F0D] px-2 pb-3 pt-4 text-center shadow-xl hover:border-[#C9A87C]/70 disabled:opacity-40`}>
                <div className="flex h-12 items-center justify-center">
                  {g === 'number' && <span className="font-mono text-3xl font-black tracking-tight text-[#3EE08A]">07</span>}
                  {g === 'card' && (
                    <span className="flex -space-x-3">
                      <span className="flex h-11 w-8 -rotate-12 items-center justify-center rounded-md bg-[#F5EDE2] text-[11px] font-black text-[#0A0F0D] shadow-lg">A♠</span>
                      <span className="flex h-11 w-8 rotate-6 items-center justify-center rounded-md bg-[#F5EDE2] text-[11px] font-black text-[#E23B52] shadow-lg">K♥</span>
                    </span>
                  )}
                  {g === 'colour' && (
                    <span className="flex gap-1.5">
                      {(['RED', 'BLUE', 'GREEN'] as const).map(c => <span key={c} className={`h-5 w-5 rounded-full ${COLOURS[c].bg} shadow-lg`} />)}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm font-extrabold text-white">{TILE[g].title}</p>
                <p className="text-[9px] font-medium text-gray-400">{TILE[g].blurb}</p>
                <span className={`mt-2 rounded-full px-2 py-0.5 font-mono text-[10px] font-extrabold tabular-nums ${locked ? 'bg-white/10 text-gray-300' : 'bg-[#3EE08A]/15 text-[#3EE08A]'}`}>
                  {locked ? `Result ${clock(left)}` : `Closes ${clock(left)}`}
                </span>
                <span className="mt-1.5 text-[9px] font-bold text-[#E0C9A0]">Pays {t.payout}x</span>
                {last && (
                  <span className="mt-1 flex items-center gap-1 text-[9px] text-gray-500">Last <OptionTag game={g} value={last} /></span>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
