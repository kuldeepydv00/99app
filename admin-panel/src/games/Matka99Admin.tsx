import { useEffect, useState } from 'react';
import { apiGet, apiPost, inr, istToday, istTime, heat, usePolling, Card, Kpi, Pill } from './common';

export default function Matka99Admin() {
  const [date, setDate] = useState(istToday());
  const [overview, setOverview] = useState<any>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [matrixMarket, setMatrixMarket] = useState('Gali');
  const [matrix, setMatrix] = useState<any>(null);

  const [betFilter, setBetFilter] = useState({ market: '', number: '', mobile: '' });
  const [bets, setBets] = useState<any[]>([]);

  const [chart, setChart] = useState<any>(null);
  const [limits, setLimits] = useState<any>(null);

  const [declare, setDeclare] = useState<{ market: string; date: string; number: string } | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [declaring, setDeclaring] = useState(false);

  const refreshOverview = usePolling(async () => {
    try {
      const d = await apiGet(`/api/admin/games/matka99/overview?date=${date}`);
      setOverview(d);
      setLimits((l: any) => l || { minBet: d.config.minBet, maxBet: d.config.maxBet });
      setError('');
    } catch (e: any) { setError(e.message); }
  }, 8000, [date]);

  usePolling(async () => {
    const d = await apiGet(`/api/admin/games/matka99/matrix?market=${encodeURIComponent(matrixMarket)}&date=${date}`);
    setMatrix(d);
  }, 10000, [matrixMarket, date]);

  usePolling(async () => {
    const q = new URLSearchParams({ date });
    if (betFilter.market) q.set('market', betFilter.market);
    if (betFilter.number) q.set('number', betFilter.number);
    if (betFilter.mobile) q.set('mobile', betFilter.mobile);
    const d = await apiGet(`/api/admin/games/matka99/bets?${q.toString()}`);
    setBets(d.bets || []);
  }, 10000, [date, betFilter.market, betFilter.number, betFilter.mobile]);

  usePolling(async () => { setChart(await apiGet('/api/admin/games/matka99/chart?days=30')); }, 30000, []);

  // Live payout preview while typing the result
  useEffect(() => {
    setPreview(null);
    if (!declare || !/^\d{1,2}$/.test(declare.number)) return;
    let alive = true;
    apiPost('/api/admin/games/matka99/preview', declare)
      .then(d => { if (alive) setPreview(d.preview); })
      .catch(e => { if (alive) setPreview({ error: e.message }); });
    return () => { alive = false; };
  }, [declare?.market, declare?.date, declare?.number]);

  const toggleMarket = async (market: string, enabled: boolean) => {
    try {
      await apiPost('/api/admin/games/matka99/toggle', { market, enabled });
      setNotice(`${enabled ? 'Enabled' : 'Disabled'} ${market}`);
      refreshOverview();
    } catch (e: any) { setError(e.message); }
  };

  const confirmDeclare = async () => {
    if (!declare) return;
    setDeclaring(true);
    try {
      const d = await apiPost('/api/admin/games/matka99/declare', declare);
      setNotice(`✅ ${d.result.market} ${d.result.date}: declared ${d.result.number} · ${d.result.winners} winners · ${inr(d.result.totalPaid)} paid`);
      setDeclare(null);
      refreshOverview();
    } catch (e: any) {
      setPreview((p: any) => ({ ...(p || {}), error: e.message }));
    }
    setDeclaring(false);
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
  const matrixMax = matrix ? Math.max(0, ...Object.values(matrix.totals as Record<string, number>)) : 0;
  const top5 = matrix ? Object.entries(matrix.totals as Record<string, number>).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#DEE2E6] bg-white p-4 shadow-sm">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#212529]"><span>💎</span>99x Matka</h1>
          <p className="mt-1 text-xs text-gray-500">Same 8 markets and timings as Matka, renamed · Jodi only · fixed 99x payout (ignores rate settings)</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
          Date (IST)
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-bold focus:border-blue-500 focus:outline-none" />
        </label>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">⚠️ {error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">{notice}</div>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Staked on this date" value={inr(totalStaked)} sub={`${totalBets} bets`} />
        <Kpi label="Paid out" value={inr(totalPaid)} />
        <Kpi label="Net" value={<span className={totalStaked - totalPaid >= 0 ? 'text-emerald-700' : 'text-red-600'}>{inr(totalStaked - totalPaid)}</span>} />
        <Kpi label="Open now" value={`${markets.filter(m => m.isOpen).length} / 8`} sub="markets taking bets" />
      </div>

      <Card title="Markets">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-left text-[11px] uppercase text-gray-500">
              <tr>
                <th className="px-2 py-2">99x market</th><th className="px-2 py-2">Matka twin</th><th className="px-2 py-2">Open → Close</th>
                <th className="px-2 py-2">Status</th><th className="px-2 py-2 text-right">Staked</th><th className="px-2 py-2 text-right">Bets</th>
                <th className="px-2 py-2 text-right">Players</th><th className="px-2 py-2">Result</th><th className="px-2 py-2">On/off</th><th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {markets.map(m => (
                <tr key={m.key} className="border-t border-gray-100">
                  <td className="px-2 py-2.5 font-bold text-gray-900">{m.name}</td>
                  <td className="px-2 py-2.5 text-gray-500">{m.key}</td>
                  <td className="px-2 py-2.5 text-gray-600">{m.open} → {m.close}</td>
                  <td className="px-2 py-2.5">
                    {m.result ? <Pill tone="gold">Declared</Pill> : m.isOpen ? <Pill tone="green">Open</Pill> : <Pill tone="grey">Closed</Pill>}
                  </td>
                  <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{inr(m.staked)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{m.betCount}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{m.players}</td>
                  <td className="px-2 py-2.5 font-mono text-base font-extrabold">{m.result ?? '—'}</td>
                  <td className="px-2 py-2.5">
                    <input type="checkbox" checked={m.enabled} onChange={e => toggleMarket(m.key, e.target.checked)} title="Accept bets on this 99x market" />
                  </td>
                  <td className="px-2 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => { setMatrixMarket(m.key); }} className="mr-1 rounded border border-gray-300 px-2 py-1 text-[11px] font-semibold hover:bg-gray-50">Matrix</button>
                    <button disabled={!!m.result} onClick={() => setDeclare({ market: m.key, date, number: '' })}
                      className="rounded bg-[#007BFF] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#0069D9] disabled:opacity-40">Declare</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-gray-500">Desawarr bets placed in the evening belong to the next day&apos;s date, the same way Desawar does.</p>
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
                  <div key={n} style={heat(matrix.totals[n], matrixMax)}
                    className={`rounded-md border px-1 py-1.5 text-center ${matrix.result === n ? 'border-amber-500 ring-2 ring-amber-400' : 'border-gray-200'}`}>
                    <div className="font-mono text-xs font-bold">{n}</div>
                    <div className="text-[10px] tabular-nums">{matrix.totals[n] ? inr(matrix.totals[n]) : '—'}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Most-bet numbers">
            {top5.length === 0 ? <p className="text-xs text-gray-400">No bets for this market and date</p> : (
              <ol className="space-y-2 text-xs">
                {top5.map(([n, v], i) => (
                  <li key={n} className="flex items-center justify-between">
                    <span><span className="mr-2 text-gray-400">{i + 1}.</span><span className="font-mono text-sm font-extrabold">{n}</span></span>
                    <span className="tabular-nums font-semibold">{inr(v)} · pays {inr(v * 99)}</span>
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
                <p className="text-[11px] text-gray-500">Payout is fixed at 99x and cannot be changed.</p>
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
          <input value={betFilter.number} maxLength={2} onChange={e => setBetFilter({ ...betFilter, number: e.target.value.replace(/[^0-9]/g, '') })} placeholder="Number" className="w-20 rounded border border-gray-300 px-2 py-1 text-[11px]" />
          <input value={betFilter.mobile} onChange={e => setBetFilter({ ...betFilter, mobile: e.target.value.replace(/[^0-9]/g, '') })} placeholder="Mobile" className="w-32 rounded border border-gray-300 px-2 py-1 text-[11px]" />
        </div>}>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 text-left text-[11px] uppercase text-gray-500">
              <tr><th className="px-2 py-2">Time</th><th className="px-2 py-2">Market</th><th className="px-2 py-2">Player</th><th className="px-2 py-2">Mobile</th>
                <th className="px-2 py-2">Number</th><th className="px-2 py-2 text-right">Amount</th><th className="px-2 py-2">Status</th><th className="px-2 py-2 text-right">Win</th></tr>
            </thead>
            <tbody>
              {bets.length === 0 && <tr><td colSpan={8} className="px-2 py-6 text-center text-gray-400">No bets for these filters</td></tr>}
              {bets.map(b => (
                <tr key={b.id} className="border-t border-gray-100">
                  <td className="px-2 py-2 text-gray-500">{istTime(b.created_at)}</td>
                  <td className="px-2 py-2 font-semibold">{b.marketName}</td>
                  <td className="px-2 py-2">{b.user}</td>
                  <td className="px-2 py-2 font-mono">{b.mobile}</td>
                  <td className="px-2 py-2 font-mono text-sm font-extrabold">{b.option}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{inr(b.amount)}</td>
                  <td className="px-2 py-2">{b.status === 'won' ? <Pill tone="gold">Won</Pill> : b.status === 'lost' ? <Pill tone="grey">Lost</Pill> : <Pill tone="blue">Pending</Pill>}</td>
                  <td className="px-2 py-2 text-right font-bold tabular-nums">{b.win_amount ? inr(b.win_amount) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="99x chart (last 30 dates)">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-left text-[11px] uppercase text-gray-500">
              <tr><th className="px-2 py-2">Date</th>{chart?.markets.map((m: any) => <th key={m.key} className="px-2 py-2 text-center">{m.name}</th>)}</tr>
            </thead>
            <tbody>
              {(!chart || chart.rows.length === 0) && <tr><td colSpan={9} className="px-2 py-6 text-center text-gray-400">No 99x results declared yet</td></tr>}
              {chart?.rows.map((row: any) => (
                <tr key={row.date} className="border-t border-gray-100">
                  <td className="px-2 py-2 font-semibold">{row.date}</td>
                  {chart.markets.map((m: any) => <td key={m.key} className="px-2 py-2 text-center font-mono font-bold">{row.results[m.key] ?? '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Declare dialog */}
      {declare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeclare(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">Declare 99x result</h3>
            <p className="mt-0.5 text-xs text-gray-500">Winners are paid 99x immediately. This cannot be undone.</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <label className="block"><span className="mb-1 block font-semibold text-gray-700">Market</span>
                <select value={declare.market} onChange={e => setDeclare({ ...declare, market: e.target.value })} className="w-full rounded-lg border border-gray-300 px-2 py-2 font-semibold">
                  {markets.map(m => <option key={m.key} value={m.key}>{m.name}</option>)}
                </select></label>
              <label className="block"><span className="mb-1 block font-semibold text-gray-700">Date</span>
                <input type="date" value={declare.date} onChange={e => setDeclare({ ...declare, date: e.target.value })} className="w-full rounded-lg border border-gray-300 px-2 py-2 font-semibold" /></label>
            </div>
            <label className="mt-3 block text-xs"><span className="mb-1 block font-semibold text-gray-700">Winning number (00–99)</span>
              <input autoFocus inputMode="numeric" maxLength={2} value={declare.number}
                onChange={e => setDeclare({ ...declare, number: e.target.value.replace(/[^0-9]/g, '') })}
                className="w-full rounded-xl border-2 border-gray-300 px-3 py-3 text-center font-mono text-3xl font-extrabold tracking-widest focus:border-blue-500 focus:outline-none" /></label>
            {preview && !preview.error && (
              <div className="mt-3 rounded-xl bg-gray-50 p-3 text-xs">
                <div className="flex justify-between"><span>Bets on this market/date</span><b className="tabular-nums">{preview.betCount} · {inr(preview.totalStaked)}</b></div>
                <div className="mt-1 flex justify-between"><span>Winning bets on {preview.number}</span><b className="tabular-nums">{preview.winningBets}</b></div>
                <div className="mt-1 flex justify-between text-sm"><span className="font-semibold">To pay out</span><b className="tabular-nums text-red-600">{inr(preview.totalPayout)}</b></div>
                {preview.marketOpen && <p className="mt-2 font-semibold text-amber-700">⚠️ This market is still open for betting.</p>}
                {preview.alreadyDeclared && <p className="mt-2 font-semibold text-red-700">Already declared for this date.</p>}
              </div>
            )}
            {preview?.error && <p className="mt-3 text-xs font-semibold text-red-700">⚠️ {preview.error}</p>}
            <div className="mt-4 flex gap-2">
              <button onClick={() => setDeclare(null)} className="flex-1 rounded-lg border border-gray-300 py-2.5 text-xs font-bold hover:bg-gray-50">Cancel</button>
              <button onClick={confirmDeclare} disabled={declaring || !/^\d{1,2}$/.test(declare.number) || !!preview?.alreadyDeclared}
                className="flex-1 rounded-lg bg-[#28A745] py-2.5 text-xs font-bold text-white hover:bg-[#218838] disabled:opacity-40">
                {declaring ? 'Declaring…' : `Declare ${declare.number ? declare.number.padStart(2, '0') : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
