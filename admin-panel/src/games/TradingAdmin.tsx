import { useState } from 'react';
import {
  apiGet, apiPost, inr, istTime, istDateTime, mmss, heat, usePolling, useServerNow,
  Card, Kpi, Pill, OptionLabel, CardLabel, SUIT_ORDER, suitInfo, cardParts,
  BetStatus, PlayerCell, ConfirmDialog, DailyReport, ExportButton, downloadCsv
} from './common';
import type { OpenUser } from './common';

type GameKey = 'number' | 'card' | 'colour' | 'dragontiger';

const TITLES: Record<GameKey, { title: string; icon: string; blurb: string }> = {
  number: { title: 'Number Trading', icon: '🔢', blurb: '00–99 · a round every hour · bet :00–:50 · result at :60' },
  card: { title: 'Card Trading', icon: '🃏', blurb: '52 cards · a round every hour · bet :00–:50 · result at :60' },
  colour: { title: 'Colour Trading', icon: '🎨', blurb: 'Red / Blue / Green · a round every minute · bet 0–50s · result at 60s' },
  dragontiger: { title: 'Dragon Tiger', icon: '🐉', blurb: 'Dragon / Tie / Tiger · a round every minute · bet 0–50s · result at 60s' }
};
const MINUTE_GAMES: GameKey[] = ['colour', 'dragontiger'];
const pct = (f: number) => Math.round((Number(f) || 0) * 10000) / 100;
const oneIn = (f: number) => (Number(f) > 0 ? Math.round(1 / Number(f)) : 0);
// Settings form: Dragon Tiger's tie chance is edited as a percentage
const toForm = (c: any) => ({ ...c, ...(c && c.tieChance !== undefined ? { tieChancePct: pct(c.tieChance) } : {}) });

type Dialog = null | { kind: 'cancel'; roundId: string; bets: number; staked: number } | { kind: 'pause' } | { kind: 'resume' };

export default function TradingAdmin({ game, onOpenUser }: { game: GameKey; onOpenUser?: OpenUser }) {
  const meta = TITLES[game];
  const [overview, setOverview] = useState<any>(null);
  const [rounds, setRounds] = useState<any>({ total: 0, rounds: [] });
  const [withBetsOnly, setWithBetsOnly] = useState(true);
  const [roundDate, setRoundDate] = useState('');
  const [selectedRound, setSelectedRound] = useState<string | null>(null);
  const [bets, setBets] = useState<any[]>([]);
  const [mobileFilter, setMobileFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [report, setReport] = useState<any[]>([]);
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);

  const refreshOverview = usePolling(async () => {
    try {
      const d = await apiGet(`/api/admin/games/trading/${game}/overview`);
      setOverview(d);
      setForm((f: any) => f || toForm(d.config));
      setError('');
    } catch (e: any) { setError(e.message); }
  }, MINUTE_GAMES.includes(game) ? 2000 : 5000, [game]);

  const refreshRounds = usePolling(async () => {
    const q = new URLSearchParams({ limit: '100', withBetsOnly: String(withBetsOnly) });
    if (roundDate) q.set('date', roundDate);
    setRounds(await apiGet(`/api/admin/games/trading/${game}/rounds?${q.toString()}`));
  }, MINUTE_GAMES.includes(game) ? 5000 : 15000, [game, withBetsOnly, roundDate]);

  const refreshBets = usePolling(async () => {
    const roundId = selectedRound || overview?.round?.roundId || '';
    const q = new URLSearchParams();
    if (roundId && !mobileFilter.trim()) q.set('roundId', roundId);
    if (selectedRound) q.set('roundId', selectedRound);
    if (mobileFilter.trim()) q.set('mobile', mobileFilter.trim());
    if (statusFilter) q.set('status', statusFilter);
    const d = await apiGet(`/api/admin/games/trading/${game}/bets?${q.toString()}`);
    setBets(d.bets || []);
  }, 5000, [game, selectedRound, mobileFilter, statusFilter, overview?.round?.roundId]);

  usePolling(async () => {
    const d = await apiGet(`/api/admin/games/trading/${game}/report?days=14`);
    setReport(d.days || []);
  }, 30000, [game]);

  const now = useServerNow(overview?.serverTime);

  const saveConfig = async () => {
    setSaving(true); setMessage(''); setError('');
    try {
      const body: any = { enabled: form.enabled, payout: Number(form.payout), minBet: Number(form.minBet), maxBet: Number(form.maxBet) };
      if (game === 'dragontiger') {
        body.tiePayout = Number(form.tiePayout);
        body.tieChance = Number(form.tieChancePct) / 100;
      }
      const d = await apiPost(`/api/admin/games/trading/${game}/config`, body);
      setForm(toForm(d.config));
      setMessage('Settings saved. New bets use them from now on; bets already placed keep their payout.');
      refreshOverview();
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  const setEnabled = async (enabled: boolean) => {
    const d = await apiPost(`/api/admin/games/trading/${game}/config`, { enabled });
    setForm((f: any) => ({ ...(f || {}), enabled: d.config.enabled }));
    refreshOverview();
  };

  const exportBets = () => downloadCsv(`${game}-bets_${selectedRound || overview?.round?.roundId || 'all'}.csv`, [
    ['Time (IST)', 'Round', 'Player', 'Mobile', 'Option', 'Amount', 'Multiplier', 'Status', 'Win'],
    ...bets.map(b => [istDateTime(b.created_at), b.roundId, b.user, b.mobile, b.option, b.amount, b.multiplier, b.status, b.win_amount || 0])
  ]);

  const exportRounds = () => downloadCsv(`${game}-rounds.csv`, [
    ['Round', 'Status', 'Ended (IST)', 'Staked', 'Bets', 'Players', 'Result', 'On result', 'Tied', 'Winners', 'Paid', 'Net', 'Refunded', ...(game === 'dragontiger' ? ['Dragon total', 'Tiger total', 'Tie total', 'Random tie', 'Cards'] : [])],
    ...rounds.rounds.map((x: any) => [x.roundId, x.status, istDateTime(x.end), x.totalStaked, x.betCount, x.players, x.result || '', x.winningTotal ?? '', x.tiedCount ?? '', x.winners, x.totalPaid, x.net, x.refundedAmount || 0,
      ...(game === 'dragontiger' ? [x.totals?.DRAGON || 0, x.totals?.TIGER || 0, x.totals?.TIE || 0, x.randomTie ? 'yes' : 'no', x.cards ? `${x.cards.dragon} vs ${x.cards.tiger}` : ''] : [])])
  ]);

  if (!overview) {
    return <div className="p-6 text-sm text-gray-500">{error ? `⚠️ ${error}` : `Loading ${meta.title}…`}</div>;
  }

  const r = overview.round;
  const cancelled = r.status === 'cancelled';
  const locked = now >= r.lock;
  const status = cancelled ? 'Cancelled' : r.status === 'settled' ? 'Settled' : locked ? 'Locked' : 'Open';
  const countdown = cancelled ? 'Stakes refunded' : locked ? `Result in ${mmss(r.end - now)}` : `Closes in ${mmss(r.lock - now)}`;
  const totals: Record<string, number> = overview.totals || {};
  const max = Math.max(0, ...Object.values(totals));
  const lowestSet = new Set<string>(overview.projection.lowestCount <= 12 ? overview.projection.lowestOptions : []);
  const p = overview.projection;
  const canCancel = !cancelled && r.status !== 'settled' && r.betCount > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#DEE2E6] bg-white p-4 shadow-sm">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#212529]"><span>{meta.icon}</span>{meta.title}</h1>
          <p className="mt-1 text-xs text-gray-500">{game === 'dragontiger'
            ? <>{meta.blurb} · lower bet of Dragon/Tiger wins · Tie at random about 1 in {oneIn(overview.config.tieChance)} ({pct(overview.config.tieChance)}%) · Dragon/Tiger pay {overview.config.payout}x · Tie pays {overview.config.tiePayout}x · on a Tie, Dragon/Tiger bets lose</>
            : <>{meta.blurb} · lowest total bet wins, ties random · pays {overview.config.payout}x</>}</p>
        </div>
        <div className="flex items-center gap-2">
          {overview.config.enabled ? <Pill tone="green">Game ON</Pill> : <Pill tone="red">Game OFF</Pill>}
          {overview.config.enabled
            ? <button onClick={() => setDialog({ kind: 'pause' })} className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">⏸ Pause game</button>
            : <button onClick={() => setDialog({ kind: 'resume' })} className="rounded-lg bg-[#28A745] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#218838]">▶ Resume game</button>}
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">⚠️ {error}</div>}
      {!overview.config.enabled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800">
          This game is paused: players can’t place bets and no new rounds start. Rounds already running still settle normally.
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-blue-300 bg-white p-4 shadow-sm ring-1 ring-blue-100">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Live round</div>
          <div className="mt-1 font-mono text-lg font-extrabold text-gray-900">{r.roundId}</div>
          <div className="mt-0.5 flex items-center gap-2 text-xs">
            <Pill tone={status === 'Open' ? 'green' : status === 'Cancelled' ? 'red' : 'grey'}>{status}</Pill>
            <span className="font-semibold tabular-nums text-gray-700">{countdown}</span>
          </div>
          {canCancel && (
            <button onClick={() => setDialog({ kind: 'cancel', roundId: r.roundId, bets: r.betCount, staked: r.totalStaked })}
              className="mt-2 w-full rounded-lg border border-red-300 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-50">Cancel round & refund all bets</button>
          )}
        </div>
        <Kpi label="Staked this round" value={inr(r.totalStaked)} sub={`${r.betCount} bets · ${r.players} players`} />
        <Kpi label="Would win if it ended now"
          value={cancelled ? '—' : p.lowestCount > 12 ? `${p.lowestCount} options tied` : <span className="flex flex-wrap gap-2">{p.lowestOptions.map((o: string) => <OptionLabel key={o} game={game} value={o} />)}</span>}
          sub={cancelled ? 'round cancelled' : `at ${inr(p.lowestTotal)} each · pays ${p.payoutMin === p.payoutMax ? inr(p.payoutMin) : `${inr(p.payoutMin)}–${inr(p.payoutMax)}`}${p.tie ? ` · or a random Tie (${pct(p.tie.chance)}%) pays ${inr(p.tie.wouldPay)}` : ''}`} />
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
              <div key={s} className="flex min-w-[720px] items-center gap-1">
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
        {game === 'dragontiger' && (
          <div className="space-y-3">
            {overview.options.map((o: string) => {
              const w = max ? Math.round((totals[o] / max) * 100) : 0;
              const bar = o === 'DRAGON' ? 'bg-red-500' : o === 'TIGER' ? 'bg-blue-500' : 'bg-emerald-500';
              return (
                <div key={o} className="flex items-center gap-3">
                  <div className="w-24"><OptionLabel game="dragontiger" value={o} /></div>
                  <div className="h-7 flex-1 overflow-hidden rounded-lg bg-gray-100">
                    <div className={`h-full ${bar} transition-all duration-500`} style={{ width: `${w}%` }} />
                  </div>
                  <div className="w-28 text-right text-sm font-bold tabular-nums">{inr(totals[o])}</div>
                  <div className="w-32 text-right">{o === 'TIE' ? <Pill tone="grey">random · 1 in {oneIn(overview.config.tieChance)}</Pill> : lowestSet.has(o) ? <Pill tone="green">lower</Pill> : null}</div>
                </div>
              );
            })}
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
          <Card title="Past rounds" right={
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={roundDate} onChange={e => setRoundDate(e.target.value)} title="Only rounds on this date (IST)"
                className="rounded border border-gray-300 px-2 py-1 text-[11px]" />
              {roundDate && <button onClick={() => setRoundDate('')} className="text-[11px] font-semibold text-blue-600 hover:underline">All dates</button>}
              <label className="flex items-center gap-1.5 text-[11px] text-gray-600">
                <input type="checkbox" checked={withBetsOnly} onChange={e => { setWithBetsOnly(e.target.checked); setTimeout(refreshRounds, 0); }} />
                With bets only
              </label>
              <ExportButton onClick={exportRounds} disabled={rounds.rounds.length === 0} />
            </div>}>
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
                    <tr><td colSpan={10} className="px-2 py-6 text-center text-gray-400">No finished rounds{roundDate ? ' on this date' : ' yet'}</td></tr>
                  )}
                  {rounds.rounds.map((x: any) => (
                    <tr key={x.roundId} onClick={() => setSelectedRound(x.roundId)}
                      className={`cursor-pointer border-t border-gray-100 hover:bg-blue-50 ${selectedRound === x.roundId ? 'bg-blue-50' : ''} ${x.status === 'cancelled' ? 'text-gray-400' : ''}`}>
                      <td className="px-2 py-2 font-mono font-semibold">{x.roundId}</td>
                      <td className="px-2 py-2 text-gray-500">{istDateTime(x.end)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{inr(x.totalStaked)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{x.betCount}</td>
                      {x.status === 'cancelled' ? (
                        <td colSpan={6} className="px-2 py-2"><Pill tone="red">Cancelled</Pill> <span className="ml-1 text-[11px]">{inr(x.refundedAmount)} refunded on {x.refundedBets} bets{x.cancelReason ? ` · ${x.cancelReason}` : ''}</span></td>
                      ) : (
                        <>
                          <td className="px-2 py-2">
                            <OptionLabel game={game} value={x.result} />
                            {game === 'dragontiger' && x.cards && <span className="ml-1.5 font-mono text-[10px] text-gray-500">{x.cards.dragon} vs {x.cards.tiger}</span>}
                            {game === 'dragontiger' && x.randomTie && <span className="ml-1.5"><Pill tone="grey">random</Pill></span>}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">{inr(x.winningTotal)}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{x.tiedCount}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{x.winners}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{inr(x.totalPaid)}</td>
                          <td className={`px-2 py-2 text-right font-bold tabular-nums ${x.net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{inr(x.net)}</td>
                        </>
                      )}
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
                <label className="mb-1 block font-semibold text-gray-700">{game === 'dragontiger' ? 'Dragon / Tiger payout (x)' : 'Payout multiplier (x)'}</label>
                <input type="number" step="0.1" value={form.payout} onChange={e => setForm({ ...form, payout: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-bold focus:border-blue-500 focus:outline-none" />
              </div>
              {game === 'dragontiger' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block font-semibold text-gray-700">Tie payout (x)</label>
                    <input type="number" step="1" value={form.tiePayout ?? ''} onChange={e => setForm({ ...form, tiePayout: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 font-bold focus:border-blue-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-gray-700">Tie chance (%)</label>
                    <input type="number" step="0.5" min="0" max="50" value={form.tieChancePct ?? ''} onChange={e => setForm({ ...form, tieChancePct: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 font-bold focus:border-blue-500 focus:outline-none" />
                  </div>
                  <p className="col-span-2 text-[11px] text-gray-500">
                    {Number(form.tieChancePct) > 0 ? `About 1 in ${Math.round(100 / Number(form.tieChancePct))} rounds is a Tie, picked at random.` : 'Tie is off: every round goes to Dragon or Tiger.'} Allowed 0–50%, Tie payout 2–100x.
                  </p>
                </div>
              )}
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
              <p className="text-[11px] text-gray-500">Players see the payout and limits on the game screen and in “How it works”.</p>
            </div>
          )}
        </Card>
      </div>

      {/* Bets */}
      <Card title={<span>Bets · {mobileFilter && !selectedRound ? <>player <span className="font-mono">{mobileFilter}</span> (all rounds)</> : <><span className="font-mono">{selectedRound || r.roundId}</span>{!selectedRound && ' (live)'}</>}</span>} right={
        <div className="flex flex-wrap items-center gap-2">
          {selectedRound && <button onClick={() => setSelectedRound(null)} className="rounded border border-gray-300 px-2 py-1 text-[11px] font-semibold hover:bg-gray-50">Back to live round</button>}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-[11px]">
            <option value="">All statuses</option><option value="pending">Pending</option><option value="won">Won</option><option value="lost">Lost</option><option value="refunded">Refunded</option>
          </select>
          <input value={mobileFilter} onChange={e => setMobileFilter(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Filter by mobile"
            className="w-36 rounded border border-gray-300 px-2 py-1 text-[11px] focus:border-blue-500 focus:outline-none" />
          <ExportButton onClick={exportBets} disabled={bets.length === 0} />
        </div>}>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 text-left text-[11px] uppercase text-gray-500">
              <tr><th className="px-2 py-2">Time</th><th className="px-2 py-2">Round</th><th className="px-2 py-2">Player</th><th className="px-2 py-2">Option</th>
                <th className="px-2 py-2 text-right">Amount</th><th className="px-2 py-2 text-right">x</th><th className="px-2 py-2">Status</th><th className="px-2 py-2 text-right">Win</th></tr>
            </thead>
            <tbody>
              {bets.length === 0 && <tr><td colSpan={8} className="px-2 py-6 text-center text-gray-400">No bets</td></tr>}
              {bets.map((b: any) => (
                <tr key={b.id} className="border-t border-gray-100">
                  <td className="px-2 py-2 text-gray-500">{selectedRound || !mobileFilter ? istTime(b.created_at) : istDateTime(b.created_at)}</td>
                  <td className="px-2 py-2 font-mono text-[11px] text-gray-500">{b.roundId}</td>
                  <td className="px-2 py-2"><PlayerCell name={b.user} mobile={b.mobile} onOpenUser={onOpenUser} /></td>
                  <td className="px-2 py-2"><OptionLabel game={game} value={b.option} /></td>
                  <td className="px-2 py-2 text-right tabular-nums">{inr(b.amount)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{b.multiplier}</td>
                  <td className="px-2 py-2"><BetStatus status={b.status} /></td>
                  <td className="px-2 py-2 text-right font-bold tabular-nums">{b.win_amount ? inr(b.win_amount) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Daily report */}
      <Card title="Last 14 days" right={<ExportButton disabled={report.length === 0} onClick={() => downloadCsv(`${game}-daily.csv`, [
        ['Date', 'Bets', 'Players', 'Staked', 'Paid', 'Net', 'Refunded', 'Rounds', 'Cancelled rounds'],
        ...report.map(d => [d.date, d.bets, d.players, d.staked, d.paid, d.net, d.refunded, d.rounds, d.cancelledRounds])
      ])} />}>
        <DailyReport days={report} extra={{ label: 'Rounds', render: d => <>{d.rounds}{d.cancelledRounds ? <span className="text-red-500"> · {d.cancelledRounds} cancelled</span> : null}</> }} />
      </Card>

      {/* Dialogs */}
      {dialog?.kind === 'cancel' && (
        <ConfirmDialog title={`Cancel round ${dialog.roundId}?`} tone="red" askReason confirmLabel="Cancel round & refund"
          onClose={() => { setDialog(null); refreshOverview(); refreshRounds(); refreshBets(); }}
          onConfirm={async reason => {
            const d = await apiPost(`/api/admin/games/trading/${game}/cancel-round`, { roundId: dialog.roundId, reason });
            return <p>✅ Round <b className="font-mono">{d.cancelled.roundId}</b> cancelled. <b>{inr(d.cancelled.refundedAmount)}</b> refunded on <b>{d.cancelled.refundedBets}</b> bets, back to the wallets they came from.</p>;
          }}>
          <p>All <b>{dialog.bets}</b> bets in this round (<b>{inr(dialog.staked)}</b>) will be refunded and no result will be declared for it.</p>
          <p>Players can’t bet again until the next round starts. Use this only when something went wrong with the round.</p>
        </ConfirmDialog>
      )}
      {dialog?.kind === 'pause' && (
        <ConfirmDialog title={`Pause ${meta.title}?`} tone="red" confirmLabel="Pause game"
          onClose={() => setDialog(null)}
          onConfirm={async () => { await setEnabled(false); }}>
          <p>Players won’t be able to place new bets and no new rounds will start. The current round still settles normally with the bets already placed.</p>
        </ConfirmDialog>
      )}
      {dialog?.kind === 'resume' && (
        <ConfirmDialog title={`Resume ${meta.title}?`} tone="green" confirmLabel="Resume game"
          onClose={() => setDialog(null)}
          onConfirm={async () => { await setEnabled(true); }}>
          <p>A new round starts on the next {MINUTE_GAMES.includes(game) ? 'minute' : 'hour'} and players can bet again.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
