import { useState } from 'react';
import {
  apiGet, apiPost, inr, istToday, istTime, istDateTime, heat, usePolling, Card, Kpi, Pill,
  BetStatus, PlayerCell, ConfirmDialog, DailyReport, ExportButton, downloadCsv, matkaPick
} from './common';
import type { OpenUser } from './common';

type Dialog = null | { kind: 'refund'; market: string; name: string; date: string; bets: number; staked: number };

export default function Matka99Admin({ onOpenUser }: { onOpenUser?: OpenUser }) {
  // Opens on the date the Games Overview asked for (e.g. a market still waiting for its result), else today
  const [date, setDate] = useState(() => {
    try {
      const d = localStorage.getItem('m99AdminDate');
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) { localStorage.removeItem('m99AdminDate'); return d; }
    } catch { /* ignore */ }
    return istToday();
  });
  const [overview, setOverview] = useState<any>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [matrixMarket, setMatrixMarket] = useState('Gali');
  const [matrix, setMatrix] = useState<any>(null);

  const [betFilter, setBetFilter] = useState({ market: '', number: '', mobile: '', status: '' });
  const [bets, setBets] = useState<any[]>([]);

  const [chart, setChart] = useState<any>(null);
  const [report, setReport] = useState<any[]>([]);
  const [limits, setLimits] = useState<any>(null);

  const [dialog, setDialog] = useState<Dialog>(null);

  const refreshOverview = usePolling(async () => {
    try {
      const d = await apiGet(`/api/admin/games/matka99/overview?date=${date}`);
      setOverview(d);
      setLimits((l: any) => l || { minBet: d.config.minBet, maxBet: d.config.maxBet });
      setError('');
    } catch (e: any) { setError(e.message); }
  }, 8000, [date]);

  const refreshMatrix = usePolling(async () => {
    setMatrix(await apiGet(`/api/admin/games/matka99/matrix?market=${encodeURIComponent(matrixMarket)}&date=${date}`));
  }, 10000, [matrixMarket, date]);

  const refreshBets = usePolling(async () => {
    const q = new URLSearchParams({ date });
    if (betFilter.market) q.set('market', betFilter.market);
    if (betFilter.number) q.set('number', betFilter.number);
    if (betFilter.mobile) q.set('mobile', betFilter.mobile);
    if (betFilter.status) q.set('status', betFilter.status);
    const d = await apiGet(`/api/admin/games/matka99/bets?${q.toString()}`);
    setBets(d.bets || []);
  }, 10000, [date, betFilter.market, betFilter.number, betFilter.mobile, betFilter.status]);

  const refreshChart = usePolling(async () => { setChart(await apiGet('/api/admin/games/matka99/chart?days=30')); }, 30000, []);
  const refreshReport = usePolling(async () => { setReport((await apiGet('/api/admin/games/matka99/report?days=14')).days || []); }, 30000, []);

  const refreshAll = () => { refreshOverview(); refreshMatrix(); refreshBets(); refreshChart(); refreshReport(); };

  const toggleMarket = async (market: string, enabled: boolean) => {
    try {
      await apiPost('/api/admin/games/matka99/toggle', { market, enabled });
      setNotice(`${enabled ? 'Enabled' : 'Disabled'} ${market}`);
      refreshOverview();
    } catch (e: any) { setError(e.message); }
  };

  const saveLimits = async () => {
    try {
      const d = await apiPost('/api/admin/games/matka99/limits', { minBet: Number(limits.minBet), maxBet: Number(limits.maxBet) });
      setLimits({ ...d.config });
      setNotice('Bet limits saved');
    } catch (e: any) { setError(e.message); }
  };

  if (!overview) return <div className="p-6 text-sm text-gray-500">{error ? `⚠️ ${error}` : 'Loading 99x Matka…'}</div>;

  const markets: any[] = overview.markets;
  const totalStaked = markets.reduce((s, m) => s + m.staked, 0);
  const totalPaid = markets.reduce((s, m) => s + m.paid, 0);
  const totalBets = markets.reduce((s, m) => s + m.betCount, 0);
  const totalRefunded = markets.reduce((s, m) => s + (m.refunded || 0), 0);
  const awaiting = markets.filter(m => m.awaitingResult);
  const matrixMax = matrix ? Math.max(0, ...Object.values(matrix.totals as Record<string, number>)) : 0;
  const matrixMk = markets.find(m => m.key === matrixMarket);
  const lowestSet = new Set<string>(matrixMk && !matrixMk.result && matrixMk.projection && matrixMk.projection.lowestCount <= 12 ? matrixMk.projection.lowest : []);
  const top5 = matrix ? Object.entries(matrix.totals as Record<string, number>).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5) : [];

  const exportBets = () => downloadCsv(`99x-bets_${date}${betFilter.market ? '_' + betFilter.market : ''}.csv`, [
    ['Time (IST)', 'Market', 'Market date', 'Player', 'Mobile', 'Number', 'Amount', 'Status', 'Win'],
    ...bets.map(b => [istDateTime(b.created_at), b.marketName, b.dateKey, b.user, b.mobile, matkaPick(b.option), b.amount, b.status, b.win_amount || 0])
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#DEE2E6] bg-white p-4 shadow-sm">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#212529]"><span>💎</span>99x Matka</h1>
          <p className="mt-1 text-xs text-gray-500">Same 8 markets and timings as Matka, renamed · Jodi pays 99x, Haroof (Andar/Bahar) pays 9.9x · <b>results are automatic</b> at each market’s result time: the number with the lowest total bet wins, ties random</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
          Market date (IST)
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-bold focus:border-blue-500 focus:outline-none" />
          {date !== istToday() && <button onClick={() => setDate(istToday())} className="text-[11px] font-bold text-blue-600 hover:underline">Today</button>}
        </label>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">⚠️ {error}</div>}
      {notice && <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700"><span>{notice}</span><button onClick={() => setNotice('')}>✕</button></div>}
      {awaiting.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800">
          ⏳ Result overdue: {awaiting.map(m => `${m.name} (${m.pendingBets} bets, ${inr(m.staked)})`).join(' · ')} — the server was probably off at result time. It is declared automatically within a minute of the backend running.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Kpi label="Staked on this date" value={inr(totalStaked)} sub={`${totalBets} bets`} />
        <Kpi label="Paid out" value={inr(totalPaid)} />
        <Kpi label="Net" value={<span className={totalStaked - totalPaid >= 0 ? 'text-emerald-700' : 'text-red-600'}>{inr(totalStaked - totalPaid)}</span>} />
        <Kpi label="Open now" value={`${markets.filter(m => m.isOpen).length} / 8`} sub="markets taking bets" />
        <Kpi label="Refunded" value={inr(totalRefunded)} sub="cancelled markets" />
      </div>

      <Card title="Markets">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-left text-[11px] uppercase text-gray-500">
              <tr>
                <th className="px-2 py-2">99x market</th><th className="px-2 py-2">Matka twin</th><th className="px-2 py-2">Open → Close · Result</th>
                <th className="px-2 py-2">Status</th><th className="px-2 py-2 text-right">Staked</th><th className="px-2 py-2 text-right">Bets</th>
                <th className="px-2 py-2 text-right">Players</th><th className="px-2 py-2 text-right">Paid</th><th className="px-2 py-2">Result</th><th className="px-2 py-2">On/off</th><th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {markets.map(m => (
                <tr key={m.key} className={`border-t border-gray-100 ${m.awaitingResult ? 'bg-amber-50/60' : ''}`}>
                  <td className="px-2 py-2.5 font-bold text-gray-900">{m.name}</td>
                  <td className="px-2 py-2.5 text-gray-500">{m.key}</td>
                  <td className="px-2 py-2.5 text-gray-600">{m.open} → {m.close}<div className="text-[10px] text-gray-400">result {m.resultTime || '—'}</div></td>
                  <td className="px-2 py-2.5">
                    {m.result ? <Pill tone="gold">Declared</Pill> : m.awaitingResult ? <Pill tone="red">Result overdue</Pill> : (m.isOpen && m.cycleDate === date) ? <Pill tone="green">Open</Pill> : <Pill tone="grey">Closed</Pill>}
                    {!m.enabled && <div className="mt-1"><Pill tone="grey">Off today</Pill></div>}
                  </td>
                  <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{inr(m.staked)}{m.refunded ? <div className="text-[10px] font-normal text-red-500">{inr(m.refunded)} refunded</div> : null}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{m.betCount}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{m.players}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{m.paid ? inr(m.paid) : '—'}</td>
                  <td className="px-2 py-2.5">
                    <span className="font-mono text-base font-extrabold">{m.result ?? '—'}</span>
                    {m.result && m.autoRecord && <div className="text-[10px] text-gray-500">auto · {inr(m.autoRecord.winningTotal)} on it{m.autoRecord.tiedCount > 1 ? ` · ${m.autoRecord.tiedCount} tied` : ''}</div>}
                    {!m.result && m.projection && m.betCount > 0 && (
                      <div className="text-[10px] text-gray-500">lowest now: {m.projection.lowestCount > 3 ? `${m.projection.lowestCount} numbers at ${inr(m.projection.lowestTotal)}` : m.projection.lowest.join(', ')}</div>
                    )}
                  </td>
                  <td className="px-2 py-2.5">
                    <input type="checkbox" checked={m.enabled} onChange={e => toggleMarket(m.key, e.target.checked)} title="Accept bets on this 99x market" />
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right">
                    <button onClick={() => setMatrixMarket(m.key)} className="mr-1 rounded border border-gray-300 px-2 py-1 text-[11px] font-semibold hover:bg-gray-50">Matrix</button>
                    {!m.result && (
                      <>
                        <span className="rounded bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-600" title="Declared automatically: lowest total bet wins">Auto {m.resultTime ? `at ${m.resultTime.replace(' IST', '')}` : ''}</span>
                        {m.pendingBets > 0 && (
                          <button onClick={() => setDialog({ kind: 'refund', market: m.key, name: m.name, date, bets: m.pendingBets, staked: m.staked })}
                            className="ml-1 rounded border border-gray-300 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50" title="Cancel this market's bets for this date and refund them">Refund</button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-gray-500">Desawarr bets placed in the evening belong to the next day&apos;s date, the same way Desawar does. Open/close times come from the Matka schedule.</p>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card title={<span>Number matrix · {markets.find(m => m.key === matrixMarket)?.name} · {date}</span>} right={
            <select value={matrixMarket} onChange={e => setMatrixMarket(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-xs font-semibold">
              {markets.map(m => <option key={m.key} value={m.key}>{m.name}</option>)}
            </select>}>
            {matrix && (
              <div className="grid grid-cols-10 gap-1">
                {Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0')).map(n => (
                  <div key={n} style={heat(matrix.totals[n], matrixMax)} title={`${n}: ${inr(matrix.totals[n])} on ${matrix.counts[n]} bets · would pay ${inr(matrix.totals[n] * 99)}`}
                    className={`rounded-md border px-1 py-1.5 text-center ${matrix.result === n ? 'border-amber-500 ring-2 ring-amber-400' : lowestSet.has(n) ? 'border-emerald-500 ring-1 ring-emerald-400' : 'border-gray-200'}`}>
                    <div className="font-mono text-xs font-bold">{n}</div>
                    <div className="text-[10px] tabular-nums">{matrix.totals[n] ? inr(matrix.totals[n]) : '—'}</div>
                  </div>
                ))}
              </div>
            )}
            {matrix?.haroof && (Object.values(matrix.haroof.andar as Record<string, number>).some(v => v > 0) || Object.values(matrix.haroof.bahar as Record<string, number>).some(v => v > 0)) && (
              <div className="mt-3 grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
                {(['andar', 'bahar'] as const).map(side => (
                  <div key={side} className="rounded-lg border border-gray-200 p-2">
                    <div className="mb-1 font-bold text-gray-700">Haroof {side === 'andar' ? 'Andar (1st digit)' : 'Bahar (2nd digit)'} · pays 9.9x</div>
                    <div className="grid grid-cols-10 gap-1">
                      {Array.from({ length: 10 }, (_, d) => String(d)).map(d => (
                        <div key={d} className="rounded border border-gray-100 py-1 text-center">
                          <div className="font-mono font-bold">{d}</div>
                          <div className="text-[10px] tabular-nums text-gray-500">{matrix.haroof[side][d] ? inr(matrix.haroof[side][d]) : '—'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="text-[11px] text-gray-500 md:col-span-2">Matrix amounts include Haroof bets split evenly over the 10 numbers they cover — that is what the automatic result compares.</p>
              </div>
            )}
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Automatic result">
            {!matrixMk ? null : matrixMk.result ? (
              <div className="text-xs text-gray-700">
                <p><b>{matrixMk.name}</b> {date}: <span className="font-mono text-lg font-extrabold">{matrixMk.result}</span></p>
                {matrixMk.autoRecord && <p className="mt-1 text-gray-500">Declared automatically · {inr(matrixMk.autoRecord.winningTotal)} was bet on it{matrixMk.autoRecord.tiedCount > 1 ? ` · picked at random from ${matrixMk.autoRecord.tiedCount} numbers tied for lowest` : ' · lowest of all 100'}</p>}
              </div>
            ) : matrixMk.projection ? (
              <div className="space-y-1 text-xs text-gray-700">
                <p>Due at <b>{matrixMk.resultTime || '—'}</b> for {matrixMk.name} · {date}</p>
                <p>If it were declared now: {matrixMk.projection.lowestCount > 12
                  ? <b>{matrixMk.projection.lowestCount} numbers tied at {inr(matrixMk.projection.lowestTotal)}</b>
                  : <b className="font-mono">{matrixMk.projection.lowest.join(', ')}</b>} {matrixMk.projection.lowestCount <= 12 && <>at {inr(matrixMk.projection.lowestTotal)}</>}</p>
                <p className="text-gray-500">Would pay {matrixMk.projection.payoutMin === matrixMk.projection.payoutMax ? inr(matrixMk.projection.payoutMin) : `${inr(matrixMk.projection.payoutMin)}–${inr(matrixMk.projection.payoutMax)}`} · green outline in the matrix = currently lowest</p>
              </div>
            ) : null}
          </Card>
          <Card title="Most-bet numbers">
            {top5.length === 0 ? <p className="text-xs text-gray-400">No bets for this market and date</p> : (
              <ol className="space-y-2 text-xs">
                {top5.map(([n, v], i) => (
                  <li key={n} className="flex items-center justify-between">
                    <span><span className="mr-2 text-gray-400">{i + 1}.</span><span className="font-mono text-sm font-extrabold">{n}</span></span>
                    <span className="font-semibold tabular-nums">{inr(v)} · pays {inr(v * 99)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          <Card title="Bet limits">
            {limits && (
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <label className="block"><span className="mb-1 block font-semibold text-gray-700">Min (₹)</span>
                    <input type="number" value={limits.minBet} onChange={e => setLimits({ ...limits, minBet: e.target.value })} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 font-bold" /></label>
                  <label className="block"><span className="mb-1 block font-semibold text-gray-700">Max per number (₹)</span>
                    <input type="number" value={limits.maxBet} onChange={e => setLimits({ ...limits, maxBet: e.target.value })} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 font-bold" /></label>
                </div>
                <button onClick={saveLimits} className="w-full rounded-lg bg-[#007BFF] py-2 text-xs font-bold text-white hover:bg-[#0069D9]">Save limits</button>
                <p className="text-[11px] text-gray-500">Payouts are fixed (Jodi 99x, Haroof 9.9x) and cannot be changed.</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Card title="Bets" right={
        <div className="flex flex-wrap items-center gap-2">
          <select value={betFilter.market} onChange={e => setBetFilter({ ...betFilter, market: e.target.value })} className="rounded border border-gray-300 px-2 py-1 text-[11px]">
            <option value="">All markets</option>
            {markets.map(m => <option key={m.key} value={m.key}>{m.name}</option>)}
          </select>
          <select value={betFilter.status} onChange={e => setBetFilter({ ...betFilter, status: e.target.value })} className="rounded border border-gray-300 px-2 py-1 text-[11px]">
            <option value="">All statuses</option><option value="pending">Pending</option><option value="won">Won</option><option value="lost">Lost</option><option value="refunded">Refunded</option>
          </select>
          <input value={betFilter.number} maxLength={2} onChange={e => setBetFilter({ ...betFilter, number: e.target.value.replace(/[^0-9]/g, '') })} placeholder="Number" className="w-20 rounded border border-gray-300 px-2 py-1 text-[11px]" />
          <input value={betFilter.mobile} onChange={e => setBetFilter({ ...betFilter, mobile: e.target.value.replace(/[^0-9]/g, '') })} placeholder="Mobile" className="w-32 rounded border border-gray-300 px-2 py-1 text-[11px]" />
          <ExportButton onClick={exportBets} disabled={bets.length === 0} />
        </div>}>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 text-left text-[11px] uppercase text-gray-500">
              <tr><th className="px-2 py-2">Time</th><th className="px-2 py-2">Market</th><th className="px-2 py-2">Player</th>
                <th className="px-2 py-2">Number</th><th className="px-2 py-2 text-right">Amount</th><th className="px-2 py-2">Status</th><th className="px-2 py-2 text-right">Win</th></tr>
            </thead>
            <tbody>
              {bets.length === 0 && <tr><td colSpan={7} className="px-2 py-6 text-center text-gray-400">No bets for these filters</td></tr>}
              {bets.map(b => (
                <tr key={b.id} className="border-t border-gray-100">
                  <td className="px-2 py-2 text-gray-500">{istTime(b.created_at)}</td>
                  <td className="px-2 py-2 font-semibold">{b.marketName}</td>
                  <td className="px-2 py-2"><PlayerCell name={b.user} mobile={b.mobile} onOpenUser={onOpenUser} /></td>
                  <td className="px-2 py-2 font-mono text-sm font-extrabold">{matkaPick(b.option)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{inr(b.amount)}</td>
                  <td className="px-2 py-2"><BetStatus status={b.status} /></td>
                  <td className="px-2 py-2 text-right font-bold tabular-nums">{b.win_amount ? inr(b.win_amount) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Last 14 days" right={<ExportButton disabled={report.length === 0} onClick={() => downloadCsv('99x-daily.csv', [
          ['Date', 'Bets', 'Players', 'Staked', 'Paid', 'Net', 'Refunded', 'Markets declared'],
          ...report.map(d => [d.date, d.bets, d.players, d.staked, d.paid, d.net, d.refunded, d.declared])
        ])} />}>
          <DailyReport days={report} extra={{ label: 'Declared', render: d => `${d.declared}/8` }} />
        </Card>

        <Card title="99x chart (last 30 dates)">
          <div className="max-h-[360px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 text-left text-[11px] uppercase text-gray-500">
                <tr><th className="px-2 py-2">Date</th>{chart?.markets.map((m: any) => <th key={m.key} className="px-1 py-2 text-center">{m.name}</th>)}</tr>
              </thead>
              <tbody>
                {(!chart || chart.rows.length === 0) && <tr><td colSpan={9} className="px-2 py-6 text-center text-gray-400">No 99x results declared yet</td></tr>}
                {chart?.rows.map((row: any) => (
                  <tr key={row.date} className={`border-t border-gray-100 ${row.date === date ? 'bg-blue-50' : ''}`}>
                    <td className="cursor-pointer px-2 py-2 font-semibold text-blue-700 hover:underline" onClick={() => setDate(row.date)}>{row.date}</td>
                    {chart.markets.map((m: any) => <td key={m.key} className="px-1 py-2 text-center font-mono font-bold">{row.results[m.key] ?? '—'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {dialog?.kind === 'refund' && (
        <ConfirmDialog title={`Refund ${dialog.name} bets for ${dialog.date}?`} tone="red" askReason confirmLabel="Refund bets"
          onClose={() => { setDialog(null); refreshAll(); }}
          onConfirm={async reason => {
            const d = await apiPost('/api/admin/games/matka99/refund', { market: dialog.market, date: dialog.date, reason });
            return <p>✅ {d.refunded.market} {d.refunded.date}: <b>{inr(d.refunded.refundedAmount)}</b> refunded on <b>{d.refunded.refundedBets}</b> bets, back to the wallets they came from.</p>;
          }}>
          <p>All <b>{dialog.bets}</b> pending bets on <b>{dialog.name}</b> for <b>{dialog.date}</b> ({inr(dialog.staked)}) will be cancelled and refunded. No result will be needed for them.</p>
          <p>To stop new bets on this market too, switch it off in the On/off column.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
