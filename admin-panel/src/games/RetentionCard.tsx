import { useState } from 'react';
import { apiGet, apiPost, usePolling, Card, Pill, istDateTime } from './common';

// Bet history clean-up: every bet (Matka markets and all new games) is deleted when its day is
// more than 60 days old. Each deleted day is kept as one line of totals per game (no player data),
// so profit reports and "all time" totals still include it.
type Run = { at: string; by: string; cutoff: string; deletedMatka: number; deletedGames: number; pendingKept: number; duplicatesDropped: number; daysAdded: string[] };
type Status = {
  keepDays: number; cutoff: string; closedThrough: string | null; archivedDays: number;
  firstArchivedDay: string | null; lastArchivedDay: string | null; pendingKept: number;
  lastRun: Run | null; runs: Run[]; runEveryHours: number;
};

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

export default function RetentionCard() {
  const [st, setSt] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = usePolling(async () => {
    try { setSt(await apiGet<Status>('/api/admin/games/retention')); setError(''); }
    catch (e: any) { setError(e.message); }
  }, 60000);

  const runNow = async () => {
    if (!window.confirm('Delete all bets older than 60 days now?\n\nTheir daily totals are kept for the reports. Pending bets are kept until they are settled. This cannot be undone.')) return;
    setBusy(true); setNote('');
    try {
      const r = await apiPost<{ run: Run | null }>('/api/admin/games/retention/run', {});
      setNote(r.run ? `Done: ${r.run.deletedMatka + r.run.deletedGames} old bets deleted.` : 'A clean-up is already running.');
      await load();
    } catch (e: any) { setNote(`⚠️ ${e.message}`); }
    setBusy(false);
  };

  return (
    <Card title="🗂️ Bet history (kept 60 days)" right={st && <Pill tone="green">Automatic · every {st.runEveryHours} h</Pill>}>
      {!st ? <p className="py-4 text-xs text-gray-500">{error ? `⚠️ ${error}` : 'Loading…'}</p> : (
        <div className="space-y-3 text-xs text-gray-700">
          <p className="leading-relaxed text-gray-600">
            Bets of every game and Matka market are deleted when they are more than <b>{st.keepDays} days</b> old.
            Before deleting, each day is saved as one line of totals per game (bets, players, staked, paid, no names or mobiles),
            so the dashboard, profit pages and “all time” numbers still include old days. Pending bets are kept until they are settled.
            Wallet history, deposits and withdrawals are not deleted.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg bg-gray-50 p-2.5"><div className="text-[10px] font-semibold uppercase text-gray-500">Bets kept from</div><div className="mt-0.5 font-bold text-gray-900">{fmtDate(st.cutoff)}</div></div>
            <div className="rounded-lg bg-gray-50 p-2.5"><div className="text-[10px] font-semibold uppercase text-gray-500">Old days saved as totals</div><div className="mt-0.5 font-bold text-gray-900">{st.archivedDays}{st.firstArchivedDay ? ` (${fmtDate(st.firstArchivedDay)} – ${fmtDate(st.lastArchivedDay)})` : ''}</div></div>
            <div className="rounded-lg bg-gray-50 p-2.5"><div className="text-[10px] font-semibold uppercase text-gray-500">Last clean-up</div><div className="mt-0.5 font-bold text-gray-900">{st.lastRun ? istDateTime(st.lastRun.at) : 'Not run yet'}</div></div>
            <div className="rounded-lg bg-gray-50 p-2.5"><div className="text-[10px] font-semibold uppercase text-gray-500">Old pending bets waiting</div><div className="mt-0.5 font-bold text-gray-900">{st.pendingKept}</div></div>
          </div>
          {st.runs.length > 0 && (
            <div className="max-h-[180px] overflow-auto rounded-lg border border-gray-100">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-gray-50 text-left text-gray-500">
                  <tr><th className="px-2 py-1.5">When</th><th className="px-2 py-1.5">By</th><th className="px-2 py-1.5 text-right">Matka bets</th><th className="px-2 py-1.5 text-right">Game bets</th><th className="px-2 py-1.5">Days saved</th></tr>
                </thead>
                <tbody>
                  {st.runs.map(r => (
                    <tr key={r.at + r.by} className="border-t border-gray-100">
                      <td className="px-2 py-1.5">{istDateTime(r.at)}</td>
                      <td className="px-2 py-1.5">{r.by === 'auto' ? 'Automatic' : 'Admin'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.deletedMatka}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.deletedGames}</td>
                      <td className="px-2 py-1.5">{r.daysAdded.length ? `${r.daysAdded.length} (${fmtDate(r.daysAdded[0])}${r.daysAdded.length > 1 ? ` – ${fmtDate(r.daysAdded[r.daysAdded.length - 1])}` : ''})` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={runNow} disabled={busy}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50">
              {busy ? 'Running…' : 'Run clean-up now'}
            </button>
            {note && <span className="font-semibold text-gray-600">{note}</span>}
          </div>
        </div>
      )}
    </Card>
  );
}
