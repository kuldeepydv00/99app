import { inr } from './common';

const GAMES = [
  { key: 'matka99', icon: '💎', tab: 'matka99' },
  { key: 'jet', icon: '✈️', tab: 'jetGame' },
  { key: 'number', icon: '🔢', tab: 'numberTrading' },
  { key: 'card', icon: '🃏', tab: 'cardTrading' },
  { key: 'colour', icon: '🎨', tab: 'colourTrading' }
];

// Dashboard row: what the new games did in the selected period (already included in the totals above).
export default function DashboardGamesStrip({ stats, onNavigate }: { stats: any; onNavigate: (tab: string) => void }) {
  const ng = stats?.newGames;
  if (!ng) return null;
  const r = ng.range;
  return (
    <div className="rounded-lg border border-[#DEE2E6] bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-[#212529]">🎮 New games in this period</h2>
          <p className="text-[11px] text-gray-500">99x Matka, 99x Jet and Trading — already included in Total Betting and Winnings above ({inr(r.staked)} staked, {inr(r.paid)} paid).</p>
        </div>
        <button onClick={() => onNavigate('gamesOverview')} className="rounded bg-[#007BFF] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#0069D9]">Open Games Overview →</button>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="text-[10px] font-bold uppercase text-blue-700">All new games</div>
          <div className="mt-1 text-lg font-extrabold tabular-nums">{inr(r.staked)}</div>
          <div className="text-[11px] text-gray-600">{r.bets} bets · {r.players} players</div>
          <div className={`text-[11px] font-bold ${r.net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>Net {inr(r.net)}</div>
        </div>
        {GAMES.map(g => {
          const x = ng.byGame[g.key];
          return (
            <button key={g.key} onClick={() => onNavigate(g.tab)} className="rounded-lg border border-gray-200 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50/40">
              <div className="text-[10px] font-bold uppercase text-gray-500">{g.icon} {x.label}</div>
              <div className="mt-1 text-lg font-extrabold tabular-nums">{inr(x.staked)}</div>
              <div className="text-[11px] text-gray-600">{x.bets} bets · paid {inr(x.paid)}</div>
              <div className={`text-[11px] font-bold ${x.net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>Net {inr(x.net)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
