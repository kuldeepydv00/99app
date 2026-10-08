import { useState } from 'react';
import { apiGet, apiPost, inr, istDateTime, usePolling, Card, Pill, BetStatus, PlayerCell, downloadCsv, ExportButton } from './common';
import type { OpenUser } from './common';

// Admin page for Dice and Mines: admin profit (today / 7 / 30 days / all time), settings, daily report,
// biggest wins, games in play (Mines) and recent bets.

type Game = 'dice' | 'mines';
type Agg = { bets: number; players: number; staked: number; paid: number; profit: number; expectedProfit: number; wins: number; open: number; openStake: number; actualEdgePct: number | null };
type Overview = {
  game: Game; label: string; serverTime: number;
  config: { enabled: boolean; edge: number; minBet: number; maxBet: number; maxProfit: number };
  limits: { edgePct: number; rtpPct: number; maxChance?: number };
  periods: { today: Agg; days7: Agg; days30: Agg; allTime: Agg };
  topWins: { id: string; user: string; mobile: string; amount: number; win_amount: number; profit: number; option: string; result: string; at: string }[];
  activeGames: { id: string; amount: number; mines: number; picks: number; at: string }[];
  configLog: { at: string; by: string; changes: Record<string, { from: any; to: any }> }[];
  rules: string[];
};
type Day = Agg & { date: string };

const ICON: Record<Game, string> = { dice: '🎲', mines: '💣' };
const pct = (n: number | null | undefined) => (n == null ? '—' : `${n.toFixed(2)}%`);

function ProfitCard({ label, a, edgePct }: { label: string; a: Agg; edgePct: number }) {
  const up = a.profit >= 0;
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${up ? 'border-emerald-200' : 'border-red-200'}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold tabular-nums ${up ? 'text-emerald-700' : 'text-red-600'}`}>{inr(a.profit)}</div>
      <div className="mt-1 space-y-0.5 text-[11px] text-gray-500">
        <div>Bet <b className="text-gray-800">{inr(a.staked)}</b> · Paid <b className="text-gray-800">{inr(a.paid)}</b></div>
        <div>Expected at {edgePct}%: <b className="text-gray-800">{inr(a.expectedProfit)}</b></div>
        <div>{a.bets} bets · {a.players} players · edge so far {pct(a.actualEdgePct)}</div>
        {a.open > 0 && <div className="text-blue-700">{a.open} game{a.open === 1 ? '' : 's'} in play ({inr(a.openStake)})</div>}
      </div>
    </div>
  );
}

export default function InstantAdmin({ game, onOpenUser }: { game: Game; onOpenUser?: OpenUser }) {
  const [ov, setOv] = useState<Overview | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [bets, setBets] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState({ mobile: '', status: '' });
  const [form, setForm] = useState<{ enabled: boolean; edgePct: string; minBet: string; maxBet: string; maxProfit: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = usePolling(async () => {
    try {
      const [o, r] = await Promise.all([
        apiGet<Overview>(`/api/admin/games/instant/${game}/overview`),
        apiGet<{ days: Day[] }>(`/api/admin/games/instant/${game}/report?days=14`)
      ]);
      setOv(o); setDays(r.days); setError('');
      setForm(f => f ?? {
        enabled: o.config.enabled !== false, edgePct: String(Math.round(o.config.edge * 10000) / 100),
        minBet: String(o.config.minBet), maxBet: String(o.config.maxBet), maxProfit: String(o.config.maxProfit)
      });
    } catch (e: any) { setError(e.message); }
  }, 10000, [game]);

  usePolling(async () => {
    try {
      const q = new URLSearchParams({ limit: '300' });
      if (filter.mobile) q.set('mobile', filter.mobile);
      if (filter.status) q.set('status', filter.status);
      const d = await apiGet<{ bets: any[] }>(`/api/admin/games/instant/${game}/bets?${q}`);
      setBets(d.bets);
    } catch { /* keep last */ }
  }, 10000, [game, filter.mobile, filter.status]);

  const save = async () => {
    if (!form) return;
    setSaving(true); setSaveMsg(null);
    try {
      const d = await apiPost<{ changes: Record<string, unknown> }>(`/api/admin/games/instant/${game}/config`, {
        enabled: form.enabled, edgePct: Number(form.edgePct), minBet: Number(form.minBet), maxBet: Number(form.maxBet), maxProfit: Number(form.maxProfit)
      });
      setSaveMsg({ ok: true, text: Object.keys(d.changes || {}).length ? 'Saved. New settings apply to new bets.' : 'Nothing changed.' });
      setForm(null);
      await refresh();
    } catch (e: any) { setSaveMsg({ ok: false, text: e.message }); }
    setSaving(false);
  };

  if (!ov) return <div className="p-6 text-sm text-gray-500">{error || `Loading ${game === 'dice' ? 'Dice' : 'Mines'}…`}</div>;

  const edgePct = ov.limits.edgePct;
  const exportBets = () => downloadCsv(`${game}-bets.csv`, [
    ['Time', 'Player', 'Mobile', 'Bet', 'Amount', 'Multiplier', 'Result', 'Status', 'Paid', 'Admin profit'],
    ...bets.map(b => [istDateTime(b.created_at), b.user, b.mobile, b.option, b.amount, b.multiplier ?? '', b.result ?? '', b.status, b.win_amount || 0,
      b.status === 'pending' ? '' : (b.amount - (b.win_amount || 0)).toFixed(2)])
  ]);
  const exportDays = () => downloadCsv(`${game}-daily.csv`, [
    ['Date', 'Bets', 'Players', 'Bet', 'Paid', 'Admin profit', 'Expected profit', 'Edge so far %'],
    ...days.map(d => [d.date, d.bets, d.players, d.staked, d.paid, d.profit, d.expectedProfit, d.actualEdgePct ?? ''])
  ]);
  const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">{ICON[game]} {ov.label}</h1>
          <p className="text-xs text-gray-500">Instant game · house edge {edgePct}% (players get back {ov.limits.rtpPct}% on average) · max profit {inr(ov.config.maxProfit)} per bet</p>
        </div>
        {ov.config.enabled ? <Pill tone="green">Live</Pill> : <Pill tone="red">Paused</Pill>}
      </div>

      {/* Admin profit */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ProfitCard label="Admin profit · today" a={ov.periods.today} edgePct={edgePct} />
        <ProfitCard label="Last 7 days" a={ov.periods.days7} edgePct={edgePct} />
        <ProfitCard label="Last 30 days" a={ov.periods.days30} edgePct={edgePct} />
        <ProfitCard label="All time" a={ov.periods.allTime} edgePct={edgePct} />
      </div>
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
        <b>How admin profit works:</b> profit = money bet − money paid to winners. Every payout is set {edgePct}% below fair odds, so over many bets admin keeps about
        {' '}<b>₹{edgePct.toFixed(0)} of every ₹100</b> bet (the “expected” number above). Over a few bets the real profit can be higher or lower, and a single
        bet can win up to {inr(ov.config.maxProfit)}; the more bets are played, the closer the profit gets to {edgePct}%. Results are random and the same for everyone.
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Settings */}
        <Card title="Settings">
          {form && (
            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                <span className="font-semibold text-gray-700">Game is on</span>
                <input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} className="h-4 w-4" />
              </label>
              <label className="block"><span className="mb-1 block font-semibold text-gray-700">House edge % (1–50)</span>
                <input inputMode="decimal" value={form.edgePct} onChange={e => setForm({ ...form, edgePct: e.target.value.replace(/[^0-9.]/g, '') })} className={input} /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="mb-1 block font-semibold text-gray-700">Min bet ₹</span>
                  <input inputMode="numeric" value={form.minBet} onChange={e => setForm({ ...form, minBet: e.target.value.replace(/[^0-9]/g, '') })} className={input} /></label>
                <label className="block"><span className="mb-1 block font-semibold text-gray-700">Max bet ₹</span>
                  <input inputMode="numeric" value={form.maxBet} onChange={e => setForm({ ...form, maxBet: e.target.value.replace(/[^0-9]/g, '') })} className={input} /></label>
              </div>
              <label className="block"><span className="mb-1 block font-semibold text-gray-700">Max profit per bet ₹</span>
                <input inputMode="numeric" value={form.maxProfit} onChange={e => setForm({ ...form, maxProfit: e.target.value.replace(/[^0-9]/g, '') })} className={input} /></label>
              <p className="text-[11px] text-gray-500">
                {game === 'dice' ? 'A Dice bet that could profit more than this is refused.' : 'A Mines game cashes out by itself when its profit reaches this.'} Changes apply to new bets.
              </p>
              {saveMsg && <p className={`font-semibold ${saveMsg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{saveMsg.text}</p>}
              <button onClick={save} disabled={saving} className="w-full rounded-lg bg-[#007BFF] py-2.5 text-xs font-bold text-white hover:bg-[#0069D9] disabled:opacity-50">
                {saving ? 'Saving…' : 'Save settings'}
              </button>
              {ov.configLog.length > 0 && (
                <div className="border-t border-gray-100 pt-2">
                  <p className="mb-1 font-semibold text-gray-700">Recent changes</p>
                  {ov.configLog.slice(0, 5).map((c, i) => (
                    <p key={i} className="text-[11px] text-gray-500">{istDateTime(c.at)} · {Object.entries(c.changes).map(([k, v]) => `${k}: ${k === 'edge' ? `${(v.from * 100).toFixed(1)}% → ${(v.to * 100).toFixed(1)}%` : `${v.from} → ${v.to}`}`).join(', ')}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Daily report */}
        <div className="xl:col-span-2">
          <Card title="Day by day (last 14 days)" right={<ExportButton onClick={exportDays} />}>
            <div className="max-h-[380px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 text-left text-[11px] uppercase text-gray-500">
                  <tr><th className="px-2 py-2">Date</th><th className="px-2 py-2 text-right">Bets</th><th className="px-2 py-2 text-right">Players</th>
                    <th className="px-2 py-2 text-right">Bet</th><th className="px-2 py-2 text-right">Paid</th><th className="px-2 py-2 text-right">Admin profit</th>
                    <th className="px-2 py-2 text-right">Expected</th><th className="px-2 py-2 text-right">Edge so far</th></tr>
                </thead>
                <tbody>
                  {days.map(d => (
                    <tr key={d.date} className="border-t border-gray-100">
                      <td className="px-2 py-1.5 font-semibold">{d.date}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{d.bets}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{d.players}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{inr(d.staked)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{inr(d.paid)}</td>
                      <td className={`px-2 py-1.5 text-right font-bold tabular-nums ${d.profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{inr(d.profit)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{inr(d.expectedProfit)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{pct(d.actualEdgePct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Biggest wins (players' profit)">
          {ov.topWins.length === 0 ? <p className="text-xs text-gray-400">No wins yet.</p> : (
            <table className="w-full text-xs">
              <tbody>
                {ov.topWins.map(w => (
                  <tr key={w.id} className="border-t border-gray-100 first:border-0">
                    <td className="py-1.5"><PlayerCell name={w.user} mobile={w.mobile} onOpenUser={onOpenUser} /></td>
                    <td className="py-1.5 text-gray-500">{w.option}</td>
                    <td className="py-1.5 text-right tabular-nums">bet {inr(w.amount)}</td>
                    <td className="py-1.5 text-right font-bold tabular-nums text-red-600">+{inr(w.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        {game === 'mines' ? (
          <Card title={`Games in play (${ov.activeGames.length})`}>
            {ov.activeGames.length === 0 ? <p className="text-xs text-gray-400">No open Mines games right now.</p> : (
              <table className="w-full text-xs">
                <tbody>
                  {ov.activeGames.map(g => (
                    <tr key={g.id} className="border-t border-gray-100 first:border-0">
                      <td className="py-1.5 text-gray-500">{istDateTime(g.at)}</td>
                      <td className="py-1.5">{g.mines} mines</td>
                      <td className="py-1.5">{g.picks} gems open</td>
                      <td className="py-1.5 text-right tabular-nums">{inr(g.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-2 text-[11px] text-gray-500">Open games count as money bet but not yet won or lost; they settle when the player cashes out or hits a mine.</p>
          </Card>
        ) : (
          <Card title="How Dice works (as players see it)">
            <ul className="space-y-1.5 text-xs text-gray-600">{ov.rules.map((r, i) => <li key={i}>• {r}</li>)}</ul>
          </Card>
        )}
      </div>

      <Card title="Recent bets" right={(
        <div className="flex items-center gap-2">
          <input placeholder="Mobile" value={filter.mobile} onChange={e => setFilter({ ...filter, mobile: e.target.value.replace(/[^0-9]/g, '').slice(0, 10) })}
            className="w-28 rounded border border-gray-300 px-2 py-1 text-[11px]" />
          <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })} className="rounded border border-gray-300 px-2 py-1 text-[11px]">
            <option value="">All</option><option value="won">Won</option><option value="lost">Lost</option>{game === 'mines' && <option value="pending">In play</option>}
          </select>
          <ExportButton onClick={exportBets} disabled={!bets.length} />
        </div>
      )}>
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 text-left text-[11px] uppercase text-gray-500">
              <tr><th className="px-2 py-2">Time</th><th className="px-2 py-2">Player</th><th className="px-2 py-2">Bet</th><th className="px-2 py-2">Result</th>
                <th className="px-2 py-2 text-right">Amount</th><th className="px-2 py-2 text-right">Multiplier</th><th className="px-2 py-2">Status</th>
                <th className="px-2 py-2 text-right">Paid</th><th className="px-2 py-2 text-right">Admin profit</th></tr>
            </thead>
            <tbody>
              {bets.length === 0 && <tr><td colSpan={9} className="px-2 py-8 text-center text-gray-400">No bets yet</td></tr>}
              {bets.map(b => {
                const prof = b.status === 'pending' ? null : b.amount - (b.win_amount || 0);
                return (
                  <tr key={b.id} className="border-t border-gray-100">
                    <td className="px-2 py-1.5 text-gray-500">{istDateTime(b.created_at)}</td>
                    <td className="px-2 py-1.5"><PlayerCell name={b.user} mobile={b.mobile} onOpenUser={onOpenUser} /></td>
                    <td className="px-2 py-1.5">{b.option}</td>
                    <td className="px-2 py-1.5 font-mono">{b.result ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{inr(b.amount)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{b.multiplier ? `${Number(b.multiplier).toFixed(2)}x` : '—'}</td>
                    <td className="px-2 py-1.5"><BetStatus status={b.status} /></td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{b.win_amount ? inr(b.win_amount) : '—'}</td>
                    <td className={`px-2 py-1.5 text-right font-bold tabular-nums ${prof == null ? 'text-gray-400' : prof >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{prof == null ? '—' : inr(prof)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-[11px] text-gray-500">Every bet keeps its seed hash and nonce, so any result can be checked later. Players can check theirs under Fairness in the game.</p>
    </div>
  );
}
