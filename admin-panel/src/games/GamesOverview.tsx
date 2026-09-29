import { useState } from 'react';
import { apiGet, inr, istToday, istDateTime, usePolling, Card, Kpi, Pill, OptionLabel, PlayerCell, downloadCsv, ExportButton } from './common';
import type { OpenUser } from './common';

type GameKey = 'matka99' | 'number' | 'card' | 'colour';
const GAMES: { key: GameKey; tab: string; icon: string }[] = [
  { key: 'matka99', tab: 'matka99', icon: '💎' },
  { key: 'number', tab: 'numberTrading', icon: '🔢' },
  { key: 'card', tab: 'cardTrading', icon: '🃏' },
  { key: 'colour', tab: 'colourTrading', icon: '🎨' }
];
const BAR: Record<GameKey, string> = { matka99: '#E0B7A0', number: '#10B981', card: '#F59E0B', colour: '#3B82F6' };

const shift = (iso: string, days: number) => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export default function GamesOverview({ onNavigate, onOpenUser }: { onNavigate: (tab: string) => void; onOpenUser?: OpenUser }) {
  const today = istToday();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  usePolling(async () => {
    try {
      setData(await apiGet(`/api/admin/games/summary?from=${from}&to=${to}`));
      setError('');
    } catch (e: any) { setError(e.message); }
  }, 15000, [from, to]);

  const preset = (days: number, label: string) => {
    const end = days === -1 ? shift(today, -1) : today;
    const start = days === -1 ? end : shift(today, -(days - 1));
    const active = from === start && to === end;
    return (
      <button key={label} onClick={() => { setFrom(start); setTo(end); }}
        className={`rounded border px-3 py-1 text-xs font-bold shadow-sm ${active ? 'border-[#007BFF] bg-[#007BFF] text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}>{label}</button>
    );
  };

  if (!data) return <div className="p-6 text-sm text-gray-500">{error ? `⚠️ ${error}` : 'Loading new games overview…'}</div>;

  const t = data.total;
  const maxDay = Math.max(1, ...data.daily.map((d: any) => Math.max(d.staked, d.paid)));

  const exportGames = () => downloadCsv(`new-games_${data.from}_to_${data.to}.csv`, [
    ['Game', 'Bets', 'Players', 'Staked', 'Paid', 'Net', 'Refunded', 'Pending bets'],
    ...GAMES.map(g => { const x = data.games[g.key]; return [x.label, x.bets, x.players, x.staked, x.paid, x.net, x.refunded, x.pending]; }),
    ['Total', t.bets, t.players, t.staked, t.paid, t.net, t.refunded, t.pending]
  ]);

  return (
    <div className="space-y-4">
      {/* Header + range */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#DEE2E6] bg-white p-4 shadow-sm xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#212529]"><span>🎮</span>New Games Overview</h1>
          <p className="mt-1 text-xs text-gray-500">99x Matka, Number, Card and Colour Trading together · {data.from === data.to ? data.from : `${data.from} → ${data.to}`} (IST)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {preset(1, 'Today')}{preset(-1, 'Yesterday')}{preset(7, '7 days')}{preset(30, '30 days')}
          <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-xs font-bold" />
          <span className="text-xs text-gray-400">→</span>
          <input type="date" value={to} min={from} max={today} onChange={e => setTo(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-xs font-bold" />
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">⚠️ {error}</div>}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <Kpi accent label="Total staked" value={inr(t.staked)} sub={`${t.bets} bets`} />
        <Kpi label="Paid to winners" value={inr(t.paid)} sub={`${t.wins} winning bets`} />
        <Kpi label="Net (house)" value={<span className={t.net >= 0 ? 'text-emerald-700' : 'text-red-600'}>{inr(t.net)}</span>} sub={t.staked ? `${Math.round((t.net / t.staked) * 100)}% of staked` : '—'} />
        <Kpi label="Players" value={t.players} sub="placed at least one bet" />
        <Kpi label="Waiting for result" value={t.pending} sub={`${inr(t.pendingAmount)} staked`} />
        <Kpi label="Refunded" value={inr(t.refunded)} sub="cancelled rounds / markets" />
      </div>

      {/* Needs attention */}
      {(data.awaitingResults.length > 0 || GAMES.some(g => data.games[g.key].enabled === false)) && (
        <Card title={<span className="flex items-center gap-2">⚠️ Needs attention</span>}>
          <div className="space-y-2 text-xs">
            {data.awaitingResults.map((a: any) => (
              <div key={a.key + a.date} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <span><b>99x {a.name}</b> · {a.date}{a.isToday ? ' (today)' : ''} — closed with <b>{a.bets}</b> pending bets ({inr(a.staked)}), result not declared{a.resultTime ? ` · due ${a.resultTime}` : ''}</span>
                <button onClick={() => { try { localStorage.setItem('m99AdminDate', a.date); } catch { /* ignore */ } onNavigate('matka99'); }} className="rounded bg-[#007BFF] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#0069D9]">Declare in 99x Matka →</button>
              </div>
            ))}
            {GAMES.filter(g => data.games[g.key].enabled === false).map(g => (
              <div key={g.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <span><b>{data.games[g.key].label}</b> is switched off — players can’t bet on it.</span>
                <button onClick={() => onNavigate(g.tab)} className="rounded border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-bold hover:bg-gray-100">Open →</button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Per game */}
      <Card title="By game" right={<ExportButton onClick={exportGames} />}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-left text-[11px] uppercase text-gray-500">
              <tr><th className="px-2 py-2">Game</th><th className="px-2 py-2">Status</th><th className="px-2 py-2 text-right">Payout</th>
                <th className="px-2 py-2 text-right">Bets</th><th className="px-2 py-2 text-right">Players</th><th className="px-2 py-2 text-right">Staked</th>
                <th className="px-2 py-2 text-right">Paid</th><th className="px-2 py-2 text-right">Net</th><th className="px-2 py-2 text-right">Refunded</th>
                <th className="px-2 py-2 text-right">Pending</th><th className="px-2 py-2" /></tr>
            </thead>
            <tbody>
              {GAMES.map(g => {
                const x = data.games[g.key];
                return (
                  <tr key={g.key} className="border-t border-gray-100 hover:bg-blue-50/40">
                    <td className="px-2 py-2.5 font-bold text-gray-900"><span className="mr-1.5">{g.icon}</span>{x.label}</td>
                    <td className="px-2 py-2.5">{x.enabled ? <Pill tone="green">ON{g.key === 'matka99' && x.enabledMarkets !== undefined ? ` · ${x.enabledMarkets}/8` : ''}</Pill> : <Pill tone="red">OFF</Pill>}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{x.payout}x</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{x.bets}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{x.players}</td>
                    <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{inr(x.staked)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{inr(x.paid)}</td>
                    <td className={`px-2 py-2.5 text-right font-bold tabular-nums ${x.net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{inr(x.net)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-gray-500">{x.refunded ? inr(x.refunded) : '—'}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{x.pending || '—'}</td>
                    <td className="px-2 py-2.5 text-right"><button onClick={() => onNavigate(g.tab)} className="rounded border border-gray-300 px-2.5 py-1 text-[11px] font-bold hover:bg-gray-50">Manage →</button></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50 text-xs font-bold">
              <tr><td className="px-2 py-2">All new games</td><td /><td /><td className="px-2 py-2 text-right tabular-nums">{t.bets}</td><td className="px-2 py-2 text-right tabular-nums">{t.players}</td>
                <td className="px-2 py-2 text-right tabular-nums">{inr(t.staked)}</td><td className="px-2 py-2 text-right tabular-nums">{inr(t.paid)}</td>
                <td className={`px-2 py-2 text-right tabular-nums ${t.net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{inr(t.net)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{t.refunded ? inr(t.refunded) : '—'}</td><td className="px-2 py-2 text-right tabular-nums">{t.pending || '—'}</td><td /></tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        {/* Daily chart */}
        <div className="xl:col-span-3">
          <Card title="Staked vs paid by day" right={
            <span className="flex items-center gap-3 text-[11px] text-gray-500">
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#007BFF]" />Staked</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />Paid</span>
            </span>}>
            {data.daily.length === 1 ? (
              <div className="space-y-2">
                {GAMES.map(g => {
                  const x = data.daily[0][g.key];
                  const m = Math.max(1, ...GAMES.map(k => Math.max(data.daily[0][k.key].staked, data.daily[0][k.key].paid)));
                  return (
                    <div key={g.key} className="flex items-center gap-3 text-xs">
                      <div className="w-32 font-semibold text-gray-700">{g.icon} {data.games[g.key].label}</div>
                      <div className="flex-1 space-y-1">
                        <div className="h-3 rounded bg-[#007BFF]" style={{ width: `${(x.staked / m) * 100}%`, minWidth: x.staked ? 2 : 0 }} />
                        <div className="h-3 rounded bg-amber-400" style={{ width: `${(x.paid / m) * 100}%`, minWidth: x.paid ? 2 : 0 }} />
                      </div>
                      <div className="w-40 text-right tabular-nums"><div>{inr(x.staked)}</div><div className="text-gray-500">{inr(x.paid)}</div></div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="flex h-52 items-end gap-1.5" style={{ minWidth: data.daily.length * 26 }}>
                  {data.daily.map((d: any) => (
                    <div key={d.date} className="group relative flex h-full flex-1 flex-col items-center justify-end" title={`${d.date}\nStaked ${inr(d.staked)}\nPaid ${inr(d.paid)}\nNet ${inr(d.net)}`}>
                      <div className="flex h-full w-full items-end justify-center gap-0.5">
                        <div className="w-1/2 rounded-t bg-[#007BFF]" style={{ height: `${(d.staked / maxDay) * 100}%`, minHeight: d.staked ? 2 : 0 }} />
                        <div className="w-1/2 rounded-t bg-amber-400" style={{ height: `${(d.paid / maxDay) * 100}%`, minHeight: d.paid ? 2 : 0 }} />
                      </div>
                      <div className="mt-1 text-[9px] text-gray-500">{d.date.slice(8)}/{d.date.slice(5, 7)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-gray-500">
              {GAMES.map(g => <span key={g.key} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: BAR[g.key] }} />{data.games[g.key].label}: {inr(data.games[g.key].staked)}</span>)}
            </div>
          </Card>
        </div>

        {/* Biggest wins */}
        <div className="xl:col-span-2">
          <Card title="Biggest wins in this period">
            {data.topWins.length === 0 ? <p className="py-6 text-center text-xs text-gray-400">No winning bets in this period</p> : (
              <div className="max-h-[260px] overflow-auto">
                <table className="w-full text-xs">
                  <tbody>
                    {data.topWins.map((w: any) => (
                      <tr key={w.id} className="border-t border-gray-100 first:border-t-0">
                        <td className="py-2 pr-2">
                          <PlayerCell name={w.user} mobile={w.mobile} onOpenUser={onOpenUser} />
                          <div className="text-[11px] text-gray-500">{w.label}{w.market ? ` · ${w.market}` : ''}{w.roundId ? ` · ${w.roundId}` : ''} · {istDateTime(w.at)}</div>
                        </td>
                        <td className="py-2 text-right">
                          <OptionLabel game={w.game === 'matka99' ? 'number' : w.game} value={w.option} />
                          <div className="font-bold tabular-nums text-emerald-700">{inr(w.win_amount)}</div>
                          <div className="text-[10px] text-gray-400">bet {inr(w.amount)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
