import { useEffect, useState } from 'react';
import { gamesGet } from './api';

type Chart = { markets: { key: string; name: string }[]; rows: { date: string; results: Record<string, string> }[] };

export default function Matka99Chart() {
  const [chart, setChart] = useState<Chart | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    gamesGet<Chart>('/api/games/matka99/chart?days=60').then(setChart).catch(e => setErr(e.message));
  }, []);

  if (!chart) return <p className="py-8 text-center text-xs text-gray-500">{err || 'Loading 99x chart…'}</p>;
  if (chart.rows.length === 0) {
    return <div className="rounded-2xl border border-gray-800 bg-[#0C241B] py-8 text-center text-xs font-semibold text-gray-400">No 99x Matka results declared yet.</div>;
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-[#E0B7A0]/30 bg-[#0A0F0D]">
      <table className="w-full min-w-[640px] text-xs">
        <thead>
          <tr className="bg-[#1A2A22] text-[10px] uppercase tracking-wider text-[#F5EDE2]">
            <th className="sticky left-0 bg-[#1A2A22] px-3 py-2.5 text-left">Date</th>
            {chart.markets.map(m => <th key={m.key} className="px-2 py-2.5 text-center">{m.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {chart.rows.map(r => (
            <tr key={r.date} className="border-t border-gray-900">
              <td className="sticky left-0 bg-[#0A0F0D] px-3 py-2 font-semibold text-gray-300">{r.date.slice(8)}/{r.date.slice(5, 7)}</td>
              {chart.markets.map(m => (
                <td key={m.key} className="px-2 py-2 text-center font-mono text-sm font-extrabold text-[#F0DDB8]">{r.results[m.key] ?? <span className="text-gray-700">--</span>}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
