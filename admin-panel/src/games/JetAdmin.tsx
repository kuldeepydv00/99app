import { useEffect, useState } from 'react';
import {
  apiGet, apiPost, inr, istTime, istDateTime, usePolling, Card, Kpi, Pill,
  BetStatus, PlayerCell, ConfirmDialog, DailyReport, ExportButton, downloadCsv
} from './common';
import type { OpenUser } from './common';

// 99x Jet admin: live round, settings, rounds, bets, reports. Blast points are random and fixed before
// each round; nothing here can choose or reveal one before the blast.

const fmtX = (x: number | null | undefined) => (x == null ? '—' : `${Number(x).toFixed(2)}x`);
const multAt = (growth: number, ms: number) => (ms <= 0 ? 1 : Math.floor(Math.exp(growth * ms) * 100) / 100);
const pct = (n: number | null | undefined) => (n == null ? '—' : `${n.toFixed(2)}%`);
const FIELD_LABEL: Record<string, string> = {
  enabled: 'Game on', minBet: 'Min bet', maxBet: 'Max bet', maxWin: 'Max win', bettingSec: 'Betting window (s)', roundCap: 'Round limit', edge: 'House edge'
};
const showVal = (k: string, v: any) => (k === 'edge' ? `${(Number(v) * 100).toFixed(2)}%` : k === 'enabled' ? (v ? 'on' : 'off') : typeof v === 'number' && k !== 'bettingSec' ? inr(v) : String(v));

// A 200 ms clock for the live multiplier
function useFastNow(serverTime: number | undefined) {
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (serverTime) setOffset(serverTime - Date.now()); }, [serverTime]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(id); }, []);
  return now + offset;
}

type Dialog = null | { kind: 'pause' } | { kind: 'resume' } | { kind: 'save'; body: any };

export default function JetAdmin({ onOpenUser }: { onOpenUser?: OpenUser }) {
  const [ov, setOv] = useState<any>(null);
  const [rounds, setRounds] = useState<any>({ total: 0, rounds: [] });
  const [withBetsOnly, setWithBetsOnly] = useState(true);
  const [roundDate, setRoundDate] = useState('');
  const [selectedRound, setSelectedRound] = useState<string | null>(null);
  const [bets, setBets] = useState<any[]>([]);
  const [mobileFilter, setMobileFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [report, setReport] = useState<any[]>([]);
  const [form, setForm] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);

  const refreshOverview = usePolling(async () => {
    try {
      const d = await apiGet('/api/admin/games/jet/overview');
      setOv(d);
      setForm((f: any) => f || { ...d.config, edgePct: Math.round(d.config.edge * 10000) / 100 });
      setError('');
    } catch (e: any) { setError(e.message); }
  }, 2000, []);

  const refreshRounds = usePolling(async () => {
    const q = new URLSearchParams({ limit: '200', withBetsOnly: String(withBetsOnly) });
    if (roundDate) q.set('date', roundDate);
    setRounds(await apiGet(`/api/admin/games/jet/rounds?${q.toString()}`));
  }, 6000, [withBetsOnly, roundDate]);

  usePolling(async () => {
    const q = new URLSearchParams();
    const live = ov?.round?.id;
    if (selectedRound) q.set('roundId', selectedRound);
    else if (live && !mobileFilter.trim() && !statusFilter) q.set('roundId', live);
    if (mobileFilter.trim()) q.set('mobile', mobileFilter.trim());
    if (statusFilter) q.set('status', statusFilter);
    q.set('limit', '1000');
    const d = await apiGet(`/api/admin/games/jet/bets?${q.toString()}`);
    setBets(d.bets || []);
  }, 3000, [selectedRound, mobileFilter, statusFilter, ov?.round?.id]);

  usePolling(async () => {
    const d = await apiGet('/api/admin/games/jet/report?days=14');
    setReport(d.days || []);
  }, 30000, []);

  const now = useFastNow(ov?.serverTime);

  if (!ov) {
    return (
      <div className="p-6 text-sm text-gray-500">
        {error ? <>⚠️ {error}<br /><span className="text-xs">If you just updated the code, restart the backend so 99x Jet starts.</span></> : 'Loading 99x Jet…'}
      </div>
    );
  }

  const r = ov.round || {};
  const L = ov.limits;
  const live = r.phase === 'flying' && r.flyAt ? multAt(L.growth, now - r.flyAt) : null;
  const phaseLabel: Record<string, string> = { betting: 'Betting', flying: 'Flying', ended: 'Blasted', void: 'Cancelled', paused: 'Paused', waiting: 'Starting' };
  const phaseTone = r.phase === 'flying' ? 'green' : r.phase === 'betting' ? 'blue' : r.phase === 'ended' ? 'red' : 'grey';

  const buildBody = () => ({
    enabled: !!form.enabled, edgePct: Number(form.edgePct), minBet: Number(form.minBet), maxBet: Number(form.maxBet),
    maxWin: Number(form.maxWin), bettingSec: Number(form.bettingSec), roundCap: Number(form.roundCap || 0)
  });

  const setEnabled = async (enabled: boolean) => {
    const d = await apiPost('/api/admin/games/jet/config', { enabled });
    setForm((f: any) => ({ ...(f || {}), enabled: d.config.enabled }));
    refreshOverview();
  };

  const exportBets = () => downloadCsv(`jet-bets_${selectedRound || 'filtered'}.csv`, [
    ['Time (IST)', 'Round', 'Player', 'Mobile', 'Bet', 'Amount', 'Auto cash-out', 'Cashed out at', 'Status', 'Win', 'How'],
    ...bets.map(b => [istDateTime(b.created_at), b.roundId, b.user, b.mobile, b.slot, b.amount, b.auto ?? '', b.cashout ?? '', b.status, b.win_amount || 0, b.cashed_by || b.refund_reason || ''])
  ]);
  const exportRounds = () => downloadCsv('jet-rounds.csv', [
    ['Round', 'Time (IST)', 'Status', 'Blast point', 'Bets', 'Players', 'Staked', 'Paid', 'Net', 'Cash-outs', 'Refunded', 'Code (hash)', 'Seed', 'Edge'],
    ...rounds.rounds.map((x: any) => [x.id, istDateTime(x.createdAt), x.phase, x.point ?? '', x.bets, x.players, x.staked, x.paid, x.net, x.cashouts, x.refunded || 0, x.hash, x.seed, x.edge])
  ]);

  const day = ov.day;
  const rp = ov.recentPoints;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#DEE2E6] bg-white p-4 shadow-sm">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#212529]"><span>✈️</span>99x Jet</h1>
          <p className="mt-1 text-xs text-gray-500">
            Fair crash game · each blast point is random and fixed before betting opens (provably fair) · {L.edgePct}% house edge · 1.00x to {L.maxPoint}x · {L.bettingSec}s betting window
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ov.config.enabled ? <Pill tone="green">Game ON</Pill> : <Pill tone="red">Game OFF</Pill>}
          {ov.config.enabled
            ? <button onClick={() => setDialog({ kind: 'pause' })} className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">⏸ Pause game</button>
            : <button onClick={() => setDialog({ kind: 'resume' })} className="rounded-lg bg-[#28A745] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#218838]">▶ Resume game</button>}
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">⚠️ {error}</div>}
      {!ov.config.enabled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800">
          99x Jet is paused: the current round finishes normally, then no new rounds start. Bets queued for the next round are refunded.
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-blue-300 bg-white p-4 shadow-sm ring-1 ring-blue-100">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Live round</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-lg font-extrabold text-gray-900">{r.id || '—'}</span>
            <Pill tone={phaseTone as any}>{phaseLabel[r.phase] || r.phase}</Pill>
          </div>
          <div className="mt-1 font-mono text-3xl font-black tabular-nums text-gray-900">
            {r.phase === 'flying' ? fmtX(live) : r.phase === 'ended' ? <span className="text-red-600">{fmtX(r.point)}</span>
              : r.phase === 'betting' && r.bettingEndsAt ? <span className="text-blue-600">{Math.max(0, (r.bettingEndsAt - now) / 1000).toFixed(1)}s</span> : '—'}
          </div>
          <div className="mt-1 text-xs text-gray-500">{r.bets || 0} bets · {r.players || 0} players · {ov.queuedBets} queued for next</div>
        </div>
        <Kpi label="This round" value={<span>{inr(r.staked || 0)} <span className="text-sm font-semibold text-gray-500">staked</span></span>}
          sub={<>{inr(r.paid || 0)} paid on {r.cashouts || 0} cash-outs · {inr(r.openStake || 0)} still flying</>} />
        <Kpi label={`Day ${ov.date} (IST)`} value={<span className={day.net >= 0 ? 'text-emerald-700' : 'text-red-600'}>{inr(day.net)} net</span>}
          sub={<>{inr(day.staked)} staked · {inr(day.paid)} paid · {day.rounds} rounds{day.voided ? ` · ${day.voided} cancelled` : ''} · edge {pct(day.edgePct)}</>} />
        <Kpi label="Last 14 days" value={<span className={ov.last14.net >= 0 ? 'text-emerald-700' : 'text-red-600'}>{inr(ov.last14.net)} net</span>}
          sub={<>Actual edge {pct(ov.last14.edgePct)} vs set {L.edgePct}% · {inr(ov.last14.staked)} staked</>} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Kpi label="Recent rounds" value={rp.rounds.toLocaleString('en-IN')} sub="last up to 1,000 finished rounds" />
        <Kpi label="Blasted at 1.00x" value={rp.rounds ? `${(rp.instant / rp.rounds * 100).toFixed(1)}%` : '—'} sub={`expected about ${(100 - (100 - L.edgePct) / 1.01).toFixed(1)}%`} />
        <Kpi label="Reached 10x / 100x" value={rp.rounds ? `${(rp.over10 / rp.rounds * 100).toFixed(1)}% / ${(rp.over100 / rp.rounds * 100).toFixed(2)}%` : '—'} sub={`expected about ${((100 - L.edgePct) / 10).toFixed(1)}% / ${((100 - L.edgePct) / 100).toFixed(2)}% at a ${L.edgePct}% edge`} />
        <Kpi label="Highest" value={fmtX(rp.max || null)} sub={`cap ${L.maxPoint}x`} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Rounds */}
        <div className="xl:col-span-2">
          <Card title="Rounds" right={
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={roundDate} onChange={e => setRoundDate(e.target.value)} title="Only rounds on this date (IST)" className="rounded border border-gray-300 px-2 py-1 text-[11px]" />
              {roundDate && <button onClick={() => setRoundDate('')} className="text-[11px] font-semibold text-blue-600 hover:underline">All dates</button>}
              <label className="flex items-center gap-1.5 text-[11px] text-gray-600">
                <input type="checkbox" checked={withBetsOnly} onChange={e => { setWithBetsOnly(e.target.checked); setTimeout(refreshRounds, 0); }} /> With bets only
              </label>
              <ExportButton onClick={exportRounds} disabled={rounds.rounds.length === 0} />
            </div>}>
            <div className="max-h-[440px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 text-left text-[11px] uppercase text-gray-500">
                  <tr><th className="px-2 py-2">Round</th><th className="px-2 py-2">Time</th><th className="px-2 py-2 text-right">Blast</th>
                    <th className="px-2 py-2 text-right">Bets</th><th className="px-2 py-2 text-right">Staked</th><th className="px-2 py-2 text-right">Paid</th>
                    <th className="px-2 py-2 text-right">Net</th><th className="px-2 py-2">Seed</th></tr>
                </thead>
                <tbody>
                  {rounds.rounds.length === 0 && <tr><td colSpan={8} className="px-2 py-6 text-center text-gray-400">No finished rounds{roundDate ? ' on this date' : ' yet'}</td></tr>}
                  {rounds.rounds.map((x: any) => (
                    <tr key={x.id} onClick={() => setSelectedRound(x.id)}
                      className={`cursor-pointer border-t border-gray-100 hover:bg-blue-50 ${selectedRound === x.id ? 'bg-blue-50' : ''} ${x.phase === 'void' ? 'text-gray-400' : ''}`}>
                      <td className="px-2 py-2 font-mono font-semibold">{x.id}</td>
                      <td className="px-2 py-2 text-gray-500">{istTime(x.createdAt)}</td>
                      <td className={`px-2 py-2 text-right font-mono font-bold ${x.point >= 10 ? 'text-amber-600' : x.point >= 2 ? 'text-emerald-700' : 'text-gray-700'}`}>
                        {x.phase === 'void' ? <Pill tone="red">Cancelled</Pill> : fmtX(x.point)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{x.bets}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{inr(x.staked)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{inr(x.paid)}</td>
                      <td className={`px-2 py-2 text-right font-bold tabular-nums ${x.net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{x.phase === 'void' ? `${inr(x.refunded)} refunded` : inr(x.net)}</td>
                      <td className="px-2 py-2 font-mono text-[10px] text-gray-400" title={x.seed || ''}>{x.seed ? `${x.seed.slice(0, 10)}…` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-gray-500">The last 2,000 rounds are kept with their seeds; players can check any of them with Verify. Older days keep their totals.</p>
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
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['edgePct', 'House edge (%, 1–50)', '0.1'], ['bettingSec', 'Betting window (s)', '1'],
                  ['minBet', 'Min bet (₹)', '1'], ['maxBet', 'Max bet (₹)', '1'],
                  ['maxWin', 'Max win per bet (₹)', '1'], ['roundCap', 'Round limit (₹, 0 = off)', '1']
                ] as const).map(([k, label, step]) => (
                  <div key={k}>
                    <label className="mb-1 block font-semibold text-gray-700">{label}</label>
                    <input type="number" step={step} value={form[k] ?? ''} onChange={e => setForm({ ...form, [k]: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 font-bold focus:border-blue-500 focus:outline-none" />
                  </div>
                ))}
              </div>
              <button onClick={() => setDialog({ kind: 'save', body: buildBody() })}
                className="w-full rounded-lg bg-[#007BFF] py-2.5 text-xs font-bold text-white shadow hover:bg-[#0069D9]">Save settings</button>
              {message && <p className="text-[11px] font-semibold text-emerald-700">{message}</p>}
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-900">
                Settings change limits and timing only. Blast points are random and fixed before each round; no one can pick or see one in advance. A new house edge applies from the next round and is shown to players.
              </div>
              {ov.configLog.length > 0 && (
                <div>
                  <p className="mb-1 font-semibold text-gray-700">Recent changes</p>
                  <ul className="max-h-40 space-y-1 overflow-auto text-[11px] text-gray-600">
                    {ov.configLog.map((c: any, i: number) => (
                      <li key={i}><span className="text-gray-400">{istDateTime(c.at)}</span> · {Object.entries(c.changes).map(([k, v]: any) => `${FIELD_LABEL[k] || k} ${showVal(k, v.from)} → ${showVal(k, v.to)}`).join(', ')}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Bets */}
      <Card title={<span>Bets · {selectedRound ? <span className="font-mono">{selectedRound}</span> : mobileFilter || statusFilter ? 'filtered (all rounds)' : <><span className="font-mono">{r.id || '—'}</span> (live)</>}</span>} right={
        <div className="flex flex-wrap items-center gap-2">
          {selectedRound && <button onClick={() => setSelectedRound(null)} className="rounded border border-gray-300 px-2 py-1 text-[11px] font-semibold hover:bg-gray-50">Back to live round</button>}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-[11px]">
            <option value="">All statuses</option><option value="pending">Flying / waiting</option><option value="won">Cashed out</option><option value="lost">Lost</option><option value="refunded">Refunded</option>
          </select>
          <input value={mobileFilter} onChange={e => setMobileFilter(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Filter by mobile"
            className="w-36 rounded border border-gray-300 px-2 py-1 text-[11px] focus:border-blue-500 focus:outline-none" />
          <ExportButton onClick={exportBets} disabled={bets.length === 0} />
        </div>}>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 text-left text-[11px] uppercase text-gray-500">
              <tr><th className="px-2 py-2">Time</th><th className="px-2 py-2">Round</th><th className="px-2 py-2">Player</th><th className="px-2 py-2">Bet</th>
                <th className="px-2 py-2 text-right">Amount</th><th className="px-2 py-2 text-right">Auto</th><th className="px-2 py-2 text-right">Cashed out</th>
                <th className="px-2 py-2">Status</th><th className="px-2 py-2 text-right">Win</th></tr>
            </thead>
            <tbody>
              {bets.length === 0 && <tr><td colSpan={9} className="px-2 py-6 text-center text-gray-400">No bets</td></tr>}
              {bets.map((b: any) => (
                <tr key={b.id} className="border-t border-gray-100">
                  <td className="px-2 py-2 text-gray-500">{selectedRound ? istTime(b.created_at) : istDateTime(b.created_at)}</td>
                  <td className="px-2 py-2 font-mono text-[11px] text-gray-500">{b.roundId}</td>
                  <td className="px-2 py-2"><PlayerCell name={b.user} mobile={b.mobile} onOpenUser={onOpenUser} /></td>
                  <td className="px-2 py-2 text-gray-600">#{b.slot}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{inr(b.amount)}</td>
                  <td className="px-2 py-2 text-right font-mono text-gray-500">{fmtX(b.auto)}</td>
                  <td className="px-2 py-2 text-right font-mono font-bold">{b.status === 'won' ? fmtX(b.cashout) : b.status === 'lost' ? <span className="text-gray-400">✕ {fmtX(b.result)}</span> : '—'}{b.cashed_by && b.cashed_by !== 'manual' ? <span className="ml-1 text-[10px] font-normal text-gray-400">{b.cashed_by}</span> : null}</td>
                  <td className="px-2 py-2"><BetStatus status={b.status} /></td>
                  <td className="px-2 py-2 text-right font-bold tabular-nums">{b.win_amount ? inr(b.win_amount) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Daily report */}
      <Card title="Last 14 days" right={<ExportButton disabled={report.length === 0} onClick={() => downloadCsv('jet-daily.csv', [
        ['Date', 'Rounds', 'Cancelled rounds', 'Bets', 'Players', 'Staked', 'Paid', 'Net', 'Actual edge %', 'Refunded'],
        ...report.map(d => [d.date, d.rounds, d.voided, d.bets, d.players, d.staked, d.paid, d.net, d.edgePct ?? '', d.refunded])
      ])} />}>
        <DailyReport days={report} extra={{ label: 'Rounds · edge', render: d => <>{d.rounds}{d.voided ? <span className="text-red-500"> · {d.voided} cancelled</span> : null} · {pct(d.edgePct)}</> }} />
      </Card>

      {/* Fairness */}
      <Card title="Proof of fairness">
        {ov.chain ? (
          <div className="space-y-1 font-mono text-[11px] text-gray-700 break-all">
            <p><span className="text-gray-400">Chain </span>{ov.chain.id} · created {istDateTime(ov.chain.createdAt)} · {ov.chain.used.toLocaleString('en-IN')} of {ov.chain.length.toLocaleString('en-IN')} seeds used</p>
            <p><span className="text-gray-400">Published chain end: </span>{ov.chain.terminatingHash}</p>
            <p><span className="text-gray-400">Salt: </span>{ov.chain.salt}</p>
            <p className="pt-1 font-sans text-gray-500">Players see each round’s code before it starts and its seed after the blast; the game screen recomputes the blast point to prove it wasn’t changed.</p>
          </div>
        ) : <p className="text-xs text-gray-500">The seed chain is created when the game first starts.</p>}
      </Card>

      {/* Dialogs */}
      {dialog?.kind === 'pause' && (
        <ConfirmDialog title="Pause 99x Jet?" tone="red" confirmLabel="Pause game" onClose={() => setDialog(null)} onConfirm={async () => { await setEnabled(false); }}>
          <p>The round in progress finishes normally. After it, no new rounds start and players can’t bet. Bets already queued for the next round are refunded.</p>
        </ConfirmDialog>
      )}
      {dialog?.kind === 'resume' && (
        <ConfirmDialog title="Resume 99x Jet?" tone="green" confirmLabel="Resume game" onClose={() => setDialog(null)} onConfirm={async () => { await setEnabled(true); }}>
          <p>A new round starts within a second and players can bet again.</p>
        </ConfirmDialog>
      )}
      {dialog?.kind === 'save' && (
        <ConfirmDialog title="Save 99x Jet settings?" tone="blue" confirmLabel="Save settings"
          onClose={() => { setDialog(null); refreshOverview(); }}
          onConfirm={async () => {
            const d = await apiPost('/api/admin/games/jet/config', dialog.body);
            setForm({ ...d.config, edgePct: Math.round(d.config.edge * 10000) / 100 });
            const n = Object.keys(d.changes || {}).length;
            setMessage(n ? 'Settings saved. They apply from the next round and players see them in the rules.' : 'Nothing changed.');
            return <p>✅ {n ? `${n} setting${n === 1 ? '' : 's'} changed.` : 'Nothing changed.'}</p>;
          }}>
          <p>House edge {dialog.body.edgePct}% · bets {inr(dialog.body.minBet)}–{inr(dialog.body.maxBet)} · max win {inr(dialog.body.maxWin)} · {dialog.body.bettingSec}s betting · round limit {dialog.body.roundCap ? inr(dialog.body.roundCap) : 'off'}.</p>
          <p>Changes apply from the next round. Players see the new limits and edge in the rules.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
