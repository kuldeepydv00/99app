import { useState } from 'react';
import {
  apiGet, apiPost, inr, istTime, istDateTime, mmss, heat, usePolling, useServerNow,
  Card, Kpi, Pill, OptionLabel, CardLabel, SUIT_ORDER, suitInfo, cardParts
} from './common';

type GameKey = 'number' | 'card' | 'colour';

const TITLES: Record<GameKey, { title: string; icon: string; blurb: string }> = {
  number: { title: 'Number Trading', icon: '🔢', blurb: '00–99 · a round every hour · bet :00–:50 · result at :60' },
  card: { title: 'Card Trading', icon: '🃏', blurb: '52 cards · a round every hour · bet :00–:50 · result at :60' },
  colour: { title: 'Colour Trading', icon: '🎨', blurb: 'Red / Blue / Green · a round every minute · bet 0–50s · result at 60s' }
};

export default function TradingAdmin({ game }: { game: GameKey }) {
  const meta = TITLES[game];
  const [overview, setOverview] = useState<any>(null);
  const [rounds, setRounds] = useState<any>({ total: 0, rounds: [] });
  const [withBetsOnly, setWithBetsOnly] = useState(true);
  const [selectedRound, setSelectedRound] = useState<string | null>(null);
  const [bets, setBets] = useState<any[]>([]);
  const [mobileFilter, setMobileFilter] = useState('');
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  usePolling(async () => {
    try {
      const d = await apiGet(`/api/admin/games/trading/${game}/overview`);
      setOverview(d);
      setForm((f: any) => f || { ...d.config });
      setError('');
    } catch (e: any) { setError(e.message); }
  }, game === 'colour' ? 2000 : 5000, [game]);

  const refreshRounds = usePolling(async () => {
    const d = await apiGet(`/api/admin/games/trading/${game}/rounds?limit=50&withBetsOnly=${withBetsOnly}`);
    setRounds(d);
  }, game === 'colour' ? 5000 : 15000, [game, withBetsOnly]);

  usePolling(async () => {
    const roundId = selectedRound || overview?.round?.roundId || '';
    const q = new URLSearchParams();
    if (roundId) q.set('roundId', roundId);
    if (mobileFilter.trim()) q.set('mobile', mobileFilter.trim());
    const d = await apiGet(`/api/admin/games/trading/${game}/bets?${q.toString()}`);
    setBets(d.bets || []);
  }, 5000, [game, selectedRound, mobileFilter, overview?.round?.roundId]);

  const now = useServerNow(overview?.serverTime);

  const saveConfig = async () => {
    setSaving(true); setMessage(''); setError('');
    try {
      const d = await apiPost(`/api/admin/games/trading/${game}/config`, {
        enabled: form.enabled, payout: Number(form.payout), minBet: Number(form.minBet), maxBet: Number(form.maxBet)
      });
      setForm({ ...d.config });
      setMessage('Settings saved. New bets use them from now on; bets already placed keep their payout.');
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  if (!overview) {
    return <div className="p-6 text-sm text-gray-500">{error ? `⚠️ ${error}` : `Loading ${meta.title}…`}</div>;
  }

  const r = overview.round;
  const locked = now >= r.lock;
  const status = r.status === 'settled' ? 'Settled' : locked ? 'Locked' : 'Open';
  const countdown = locked ? `Result in ${mmss(r.end - now)}` : `Closes in ${mmss(r.lock - now)}`;
  const totals: Record<string, number> = overview.totals || {};
  const max = Math.max(0, ...Object.values(totals));
  const lowestSet = new Set<string>(overview.projection.lowestCount <= 12 ? overview.projection.lowestOptions : []);
  const p = overview.projection;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#DEE2E6] bg-white p-4 shadow-sm">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#212529]"><span>{meta.icon}</span>{meta.title}</h1>
          <p className="mt-1 text-xs text-gray-500">{meta.blurb} · lowest total bet wins, ties random · pays {overview.config.payout}x</p>
        </div>
        <div className="flex items-center gap-2">
          {overview.config.enabled ? <Pill tone="green">Game ON</Pill> : <Pill tone="red">Game OFF</Pill>}
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">⚠️ {error}</div>}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi accent label="Live round" value={<span className="font-mono text-lg">{r.roundId}</span>}
          sub={<span className="flex items-center gap-2"><Pill tone={status === 'Open' ? 'green' : 'grey'}>{status}</Pill><span className="tabular-nums font-semibold text-gray-700">{countdown}</span></span>} />
        <Kpi label="Staked this round" value={inr(r.totalStaked)} sub={`${r.betCount} bets · ${r.players} players`} />
        <Kpi label="Would win if it ended now"
          value={p.lowestCount > 12 ? `${p.lowestCount} options tied` : <span className="flex flex-wrap gap-2">{p.lowestOptions.map((o: string) => <OptionLabel key={o} game={game} value={o} />)}</span>}
          sub={`at ${inr(p.lowestTotal)} each · pays ${p.payoutMin === p.payoutMax ? inr(p.payoutMin) : `${inr(p.payoutMin)}–${inr(p.payoutMax)}`}`} />
        <Kpi label="Today (IST)" value={<span className={overview.today.net >= 0 ? 'text-emerald-700' : 'text-red-600'}>{inr(overview.today.net)} net</span>}
          sub={`${inr(overview.today.staked)} staked · ${inr(overview.today.paid)} paid · ${overview.today.rounds} rounds`} />
      </div>

      {/* Live heat grid */}
      <Card title="Live bets by option (this round)" right={<span className="text-[11px] text-gray-500">darker = more money · green outline = currently lowest</span>}>
        {game === 'number' && (
          <div className="grid grid-cols-10 gap-1">
            {overview.options.map((o: string) => (
              <div key={o} style={heat(totals[o], max)}
                className={`rounded-md border px-1 py-1.5 text-center ${lowestSet.has(o) ? 'border-emerald-500 ring-1 ring-emerald-400' : 'border-gray-200'}`}>
                <div className="font-mono text-xs font-bold">{o}</div>
                <div className="text-[10px] tabular-nums">{totals[o] ? inr(totals[o]) : '—'}</div>
              </div>
            ))}
          </div>
        )}
        {game === 'card' && (
          <div className="space-y-1.5 overflow-x-auto">
            {SUIT_ORDER.map(s => (
              <div key={s} className="flex items-center gap-1 min-w-[720px]">
                <div className={`w-20 shrink-0 text-xs font-bold ${suitInfo(s).red ? 'text-red-600' : 'text-gray-800'}`}>{suitInfo(s).sym} {suitInfo(s).name}</div>
                {overview.options.filter((o: string) => cardParts(o).suit === s).map((o: string) => (
                  <div key={o} style={heat(totals[o], max)}
                    className={`flex-1 rounded-md border px-1 py-1.5 text-center ${lowestSet.has(o) ? 'border-emerald-500 ring-1 ring-emerald-400' : 'border-gray-200'}`}>
                    <div className="text-xs"><CardLabel code={o} /></div>
                    <div className="text-[10px] tabular-nums">{totals[o] ? inr(totals[o]) : '—'}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        {game === 'colour' && (
          <div className="space-y-3">
            {overview.options.map((o: string) => {
              const pct = max ? Math.round((totals[o] / max) * 100) : 0;
              const bar = o === 'RED' ? 'bg-red-500' : o === 'BLUE' ? 'bg-blue-500' : 'bg-emerald-500';
              return (
                <div key={o} className="flex items-center gap-3">
                  <div className="w-24"><OptionLabel game="colour" value={o} /></div>
                  <div className="h-7 flex-1 overflow-hidden rounded-lg bg-gray-100">
                    <div className={`h-full ${bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="w-28 text-right text-sm font-bold tabular-nums">{inr(totals[o])}</div>
                  <div className="w-24 text-right">{lowestSet.has(o) ? <Pill tone="green">lowest</Pill> : null}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Rounds */}
        <div className="xl:col-span-2">
          <Card title="Settled rounds" right={
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={withBetsOnly} onChange={e => { setWithBetsOnly(e.target.checked); setTimeout(refreshRounds, 0); }} />
              Only rounds with bets
            </label>}>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 text-left text-[11px] uppercase text-gray-500">
                  <tr>
                    <th className="px-2 py-2">Round</th><th className="px-2 py-2">Ended</th><th className="px-2 py-2 text-right">Staked</th>
                    <th className="px-2 py-2 text-right">Bets</th><th className="px-2 py-2">Result</th><th className="px-2 py-2 text-right">On result</th>
                    <th className="px-2 py-2 text-right">Tied</th><th className="px-2 py-2 text-right">Winners</th><th className="px-2 py-2 text-right">Paid</th><th className="px-2 py-2 text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {rounds.rounds.length === 0 && (
                    <tr><td colSpan={10} className="px-2 py-6 text-center text-gray-400">No settled rounds yet</td></tr>
                  )}
                  {rounds.rounds.map((x: any) => (
                    <tr key={x.roundId} onClick={() => setSelectedRound(x.roundId)}
                      className={`cursor-pointer border-t border-gray-100 hover:bg-blue-50 ${selectedRound === x.roundId ? 'bg-blue-50' : ''}`}>
                      <td className="px-2 py-2 font-mono font-semibold">{x.roundId}</td>
                      <td className="px-2 py-2 text-gray-500">{istDateTime(x.end)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{inr(x.totalStaked)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{x.betCount}</td>
                      <td className="px-2 py-2"><OptionLabel game={game} value={x.result} /></td>
                      <td className="px-2 py-2 text-right tabular-nums">{inr(x.winningTotal)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{x.tiedCount}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{x.winners}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{inr(x.totalPaid)}</td>
                      <td className={`px-2 py-2 text-right font-bold tabular-nums ${x.net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{inr(x.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Settings */}
        <Card title="Game settings">
          {form && (
            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                <span className="font-semibold text-gray-700">Game enabled</span>
                <input type="checkbox" checked={!!form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} />
              </label>
              <div>
                <label className="mb-1 block font-semibold text-gray-700">Payout multiplier (x)</label>
                <input type="number" step="0.1" value={form.payout} onChange={e => setForm({ ...form, payout: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-bold focus:border-blue-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block font-semibold text-gray-700">Min bet (₹)</label>
                  <input type="number" value={form.minBet} onChange={e => setForm({ ...form, minBet: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-bold focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-gray-700">Max per option (₹)</label>
                  <input type="number" value={form.maxBet} onChange={e => setForm({ ...form, maxBet: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-bold focus:border-blue-500 focus:outline-none" />
                </div>
              </div>
              <button onClick={saveConfig} disabled={saving}
                className="w-full rounded-lg bg-[#007BFF] py-2.5 text-xs font-bold text-white shadow hover:bg-[#0069D9] disabled:opacity-50">
                {saving ? 'Saving…' : 'Save settings'}
              </button>
              {message && <p className="text-[11px] font-semibold text-emerald-700">{message}</p>}
            </div>
          )}
        </Card>
      </div>

      {/* Bets */}
      <Card title={<span>Bets · <span className="font-mono">{selectedRound || r.roundId}</span>{!selectedRound && ' (live)'}</span>} right={
        <div className="flex items-center gap-2">
          {selectedRound && <button onClick={() => setSelectedRound(null)} className="rounded border border-gray-300 px-2 py-1 text-[11px] font-semibold hover:bg-gray-50">Back to live round</button>}
          <input value={mobileFilter} onChange={e => setMobileFilter(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Filter by mobile"
            className="w-36 rounded border border-gray-300 px-2 py-1 text-[11px] focus:border-blue-500 focus:outline-none" />
        </div>}>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 text-left text-[11px] uppercase text-gray-500">
              <tr><th className="px-2 py-2">Time</th><th className="px-2 py-2">Player</th><th className="px-2 py-2">Mobile</th><th className="px-2 py-2">Option</th>
                <th className="px-2 py-2 text-right">Amount</th><th className="px-2 py-2 text-right">x</th><th className="px-2 py-2">Status</th><th className="px-2 py-2 text-right">Win</th></tr>
            </thead>
            <tbody>
              {bets.length === 0 && <tr><td colSpan={8} className="px-2 py-6 text-center text-gray-400">No bets</td></tr>}
              {bets.map((b: any) => (
                <tr key={b.id} className="border-t border-gray-100">
                  <td className="px-2 py-2 text-gray-500">{istTime(b.created_at)}</td>
                  <td className="px-2 py-2 font-semibold">{b.user}</td>
                  <td className="px-2 py-2 font-mono">{b.mobile}</td>
                  <td className="px-2 py-2"><OptionLabel game={game} value={b.option} /></td>
                  <td className="px-2 py-2 text-right tabular-nums">{inr(b.amount)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{b.multiplier}</td>
                  <td className="px-2 py-2">{b.status === 'won' ? <Pill tone="gold">Won</Pill> : b.status === 'lost' ? <Pill tone="grey">Lost</Pill> : <Pill tone="blue">Pending</Pill>}</td>
                  <td className="px-2 py-2 text-right font-bold tabular-nums">{b.win_amount ? inr(b.win_amount) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
