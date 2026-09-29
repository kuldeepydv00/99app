import { useState } from 'react';
import { apiGet, inr, istDateTime, usePolling, Pill, OptionLabel, BetStatus, ExportButton, downloadCsv, matkaPick } from './common';

const GAMES = [
  { key: 'matka99', icon: '💎' }, { key: 'number', icon: '🔢' }, { key: 'card', icon: '🃏' }, { key: 'colour', icon: '🎨' }
];

// User Details → "99x & Trading": every new-game bet this player placed, with totals.
export default function UserGamesTab({ mobile }: { mobile: string }) {
  const [data, setData] = useState<any>(null);
  const [game, setGame] = useState('');
  const [error, setError] = useState('');
  const clean = String(mobile || '').replace(/[^0-9]/g, '').slice(-10);

  usePolling(async () => {
    try {
      setData(await apiGet(`/api/admin/games/user/${clean}/bets?limit=1000${game ? `&game=${game}` : ''}`));
      setError('');
    } catch (e: any) { setError(e.message); }
  }, 15000, [clean, game]);

  if (!data) return <div className="p-4 text-xs text-gray-500">{error ? `⚠️ ${error}` : 'Loading 99x & Trading bets…'}</div>;
  const t = data.total;
  const playerNet = t.paid - t.staked;

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[#212529]">99x Matka & Trading bets</h3>
        <div className="flex items-center gap-2">
          <select value={game} onChange={e => setGame(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-[11px]">
            <option value="">All new games</option>
            {GAMES.map(g => <option key={g.key} value={g.key}>{data.games[g.key].label}</option>)}
          </select>
          <ExportButton disabled={data.bets.length === 0} onClick={() => downloadCsv(`new-game-bets_${clean}.csv`, [
            ['Time (IST)', 'Game', 'Market / Round', 'Date', 'Pick', 'Amount', 'Multiplier', 'Status', 'Win'],
            ...data.bets.map((b: any) => [istDateTime(b.created_at), b.label, b.marketName || b.roundId, b.date, b.game === 'matka99' ? matkaPick(b.option) : b.option, b.amount, b.multiplier, b.status, b.win_amount || 0])
          ])} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-5">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="text-[10px] font-bold uppercase text-blue-700">All new games</div>
          <div className="mt-1 text-sm font-extrabold tabular-nums">{inr(t.staked)} <span className="text-[10px] font-semibold text-gray-500">staked</span></div>
          <div className="text-[11px] tabular-nums text-gray-600">{t.bets} bets · won {inr(t.paid)}</div>
          <div className={`text-[11px] font-bold tabular-nums ${playerNet >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>Player {playerNet >= 0 ? 'up' : 'down'} {inr(Math.abs(playerNet))}</div>
        </div>
        {GAMES.map(g => {
          const x = data.games[g.key];
          return (
            <div key={g.key} className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-[10px] font-bold uppercase text-gray-500">{g.icon} {x.label}</div>
              <div className="mt-1 text-sm font-extrabold tabular-nums">{inr(x.staked)}</div>
              <div className="text-[11px] tabular-nums text-gray-600">{x.bets} bets · {x.wins} won · {inr(x.paid)}</div>
              {x.refunded > 0 && <div className="text-[11px] tabular-nums text-red-500">{inr(x.refunded)} refunded</div>}
              {x.pending > 0 && <div className="text-[11px] tabular-nums text-blue-600">{x.pending} pending</div>}
            </div>
          );
        })}
      </div>

      <div className="max-h-[480px] overflow-auto rounded border border-[#DEE2E6]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#F8F9FA] text-left text-[11px] uppercase text-gray-500">
            <tr><th className="px-2 py-2">Time</th><th className="px-2 py-2">Game</th><th className="px-2 py-2">Market / Round</th><th className="px-2 py-2">Pick</th>
              <th className="px-2 py-2 text-right">Amount</th><th className="px-2 py-2">Status</th><th className="px-2 py-2 text-right">Win</th></tr>
          </thead>
          <tbody>
            {data.bets.length === 0 && <tr><td colSpan={7} className="px-2 py-8 text-center text-gray-400">This player has no 99x Matka or Trading bets yet</td></tr>}
            {data.bets.map((b: any) => (
              <tr key={b.id} className="border-t border-gray-100">
                <td className="px-2 py-2 text-gray-500">{istDateTime(b.created_at)}</td>
                <td className="px-2 py-2 font-semibold">{b.label}</td>
                <td className="px-2 py-2">{b.game === 'matka99' ? <>{b.marketName} <span className="text-gray-400">· {b.dateKey}</span></> : <span className="font-mono text-[11px]">{b.roundId}</span>}</td>
                <td className="px-2 py-2">{b.game === 'matka99' ? <span className="font-mono font-bold">{matkaPick(b.option)}</span> : <OptionLabel game={b.game} value={b.option} />}</td>
                <td className="px-2 py-2 text-right tabular-nums">{inr(b.amount)}</td>
                <td className="px-2 py-2"><BetStatus status={b.status} />{b.status === 'lost' && b.result && <span className="ml-1 text-[10px] text-gray-400">result <OptionLabel game={b.game === 'matka99' ? 'number' : b.game} value={b.result} /></span>}</td>
                <td className="px-2 py-2 text-right font-bold tabular-nums">{b.win_amount ? inr(b.win_amount) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-500">Stakes come out of the same wallet as Matka (up to 10% from Bonus, then Deposit, then Winning). Wins go to the Winning balance. {data.bets.length >= 1000 && <Pill tone="grey">showing latest 1000</Pill>}</p>
    </div>
  );
}
