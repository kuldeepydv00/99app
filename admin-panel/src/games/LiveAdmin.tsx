import { useState } from 'react';
import { apiGet, apiPost, inr, istDateTime, istTime, usePolling, Card, Kpi, Pill, PlayerCell } from './common';
import type { OpenUser } from './common';

// Admin page for live players: who is online and where (real players only), what players are shown,
// the busiest moment of each day, the live bets feed and the settings.

type Place = { key: string; label: string; count: number; sub?: boolean };
type Player = { mobile: string; name: string; where: string; whereLabel: string; platform: 'web' | 'android'; since: string; lastSeen: string; balance: number | null };
type FeedEntry = {
  id: string; game: string; gameLabel: string; market: string | null; player: string; mobile: string; user: string;
  amount: number; picks: number; detail: string; status: 'won' | 'lost' | 'pending'; multiplier: number | null; payout: number | null; at: string;
};
type Live = {
  config: { enabled: boolean; minShow: number; feed: boolean };
  total: number;
  platforms: { web: number; android: number };
  places: Place[];
  players: Player[];
  shownToPlayers: { enabled: boolean; minShow: number; total: number | null; counts: Record<string, number> };
  peaks: { date: string; total: number; at: string }[];
  feed: { latest: FeedEntry[]; bigWins: FeedEntry[] };
  configLog: { at: string; by: string; changes: Record<string, { from: any; to: any }> }[];
  rules: string[];
};

const since = (iso: string) => {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

const SETTING_LABEL: Record<string, string> = { enabled: 'Show counts', minShow: 'Show number from', feed: 'Live bets feed' };

export default function LiveAdmin({ onOpenUser }: { onOpenUser?: OpenUser }) {
  const [d, setD] = useState<Live | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [place, setPlace] = useState('');
  const [tab, setTab] = useState<'latest' | 'wins'>('latest');
  const [form, setForm] = useState<{ enabled: boolean; minShow: string; feed: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = usePolling(async () => {
    try {
      const r = await apiGet<Live>('/api/admin/games/live');
      setD(r); setError('');
      setForm(f => f ?? { enabled: r.config.enabled, minShow: String(r.config.minShow), feed: r.config.feed });
    } catch (e: any) { setError(e.message); }
  }, 5000, []);

  const save = async () => {
    if (!form) return;
    setSaving(true); setSaveMsg(null);
    try {
      const r = await apiPost<{ changes: Record<string, unknown> }>('/api/admin/games/live/config', {
        enabled: form.enabled, minShow: Number(form.minShow), feed: form.feed
      });
      setSaveMsg({ ok: true, text: Object.keys(r.changes || {}).length ? 'Saved. Players see the change within 15 seconds.' : 'Nothing changed.' });
      setForm(null);
      await refresh();
    } catch (e: any) { setSaveMsg({ ok: false, text: e.message }); }
    setSaving(false);
  };

  if (!d) return <div className="p-6 text-sm text-gray-500">{error || 'Loading live players…'}</div>;

  const shown = (n: number) => (!d.config.enabled ? 'Hidden (off)' : n >= d.config.minShow ? `${n} playing` : 'Live dot');
  const max = Math.max(1, ...d.places.filter(p => !p.sub).map(p => p.count));
  const today = d.peaks[0];
  const list = d.players.filter(p => (!q || p.mobile.includes(q) || p.name.toLowerCase().includes(q.toLowerCase())) && (!place || p.where === place || p.where.startsWith(place + ':')));
  const feed = tab === 'latest' ? d.feed.latest : d.feed.bigWins;
  const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">👥 Live Players</h1>
          <p className="text-xs text-gray-500">Real players with the website or app open right now · updates every 5 seconds</p>
        </div>
        {d.config.enabled ? <Pill tone="green">Counts shown to players</Pill> : <Pill tone="grey">Counts hidden</Pill>}
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label="Online now" value={d.total} sub="logged-in players, each counted once" accent />
        <Kpi label="Website / App" value={`${d.platforms.web} / ${d.platforms.android}`} sub="where they are playing from" />
        <Kpi label="Players see" value={d.shownToPlayers.total != null ? `${d.shownToPlayers.total} online` : (d.config.enabled ? 'Live dot' : 'Nothing')}
          sub={d.config.enabled ? `numbers show from ${d.config.minShow} players` : 'counts are switched off'} />
        <Kpi label="Busiest today" value={today ? today.total : 0} sub={today ? `at ${istTime(today.at)}` : 'no players yet today'} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Where players are */}
        <div className="xl:col-span-2">
          <Card title="Where players are now">
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 text-left text-[11px] uppercase text-gray-500">
                  <tr><th className="px-2 py-2">Game / market</th><th className="px-2 py-2">Players</th><th className="w-20 px-2 py-2 text-right">Now</th><th className="w-28 px-2 py-2 text-right">Players see</th></tr>
                </thead>
                <tbody>
                  {d.places.map(p => (
                    <tr key={p.key} onClick={() => setPlace(place === p.key ? '' : p.key)}
                      className={`cursor-pointer border-t border-gray-100 hover:bg-blue-50/50 ${place === p.key ? 'bg-blue-50' : ''} ${p.sub && !p.count ? 'text-gray-400' : ''}`}>
                      <td className={`px-2 py-1.5 ${p.sub ? 'pl-6' : 'font-semibold text-gray-800'}`}>{p.label}</td>
                      <td className="px-2 py-1.5">
                        {!p.sub && <div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${(p.count / max) * 100}%` }} /></div>}
                      </td>
                      <td className="px-2 py-1.5 text-right font-bold tabular-nums">{p.count}</td>
                      <td className="px-2 py-1.5 text-right text-gray-500">{p.key === 'lobby' ? '—' : shown(p.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-gray-500">Click a row to see only those players below. “Players see” is what the website and app show for that game or market.</p>
          </Card>
        </div>

        {/* Settings */}
        <Card title="Settings">
          {form && (
            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                <span className="font-semibold text-gray-700">Show live player counts</span>
                <input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} className="h-4 w-4" />
              </label>
              <label className="block"><span className="mb-1 block font-semibold text-gray-700">Show the number from (players)</span>
                <input inputMode="numeric" value={form.minShow} onChange={e => setForm({ ...form, minShow: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) })} className={input} />
                <span className="mt-1 block text-[11px] text-gray-500">Below this, players see a green “Live” dot instead of a small number. 1 = always show the real number.</span>
              </label>
              <label className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                <span className="font-semibold text-gray-700">Live bets feed</span>
                <input type="checkbox" checked={form.feed} onChange={e => setForm({ ...form, feed: e.target.checked })} className="h-4 w-4" />
              </label>
              {saveMsg && <p className={`font-semibold ${saveMsg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{saveMsg.text}</p>}
              <button onClick={save} disabled={saving} className="w-full rounded-lg bg-[#007BFF] py-2.5 text-xs font-bold text-white hover:bg-[#0069D9] disabled:opacity-50">
                {saving ? 'Saving…' : 'Save settings'}
              </button>
              <ul className="space-y-1 border-t border-gray-100 pt-2 text-[11px] text-gray-500">{d.rules.map((r, i) => <li key={i}>• {r}</li>)}</ul>
              {d.configLog.length > 0 && (
                <div className="border-t border-gray-100 pt-2">
                  <p className="mb-1 font-semibold text-gray-700">Recent changes</p>
                  {d.configLog.slice(0, 5).map((c, i) => (
                    <p key={i} className="text-[11px] text-gray-500">{istDateTime(c.at)} · {Object.entries(c.changes).map(([k, v]) => `${SETTING_LABEL[k] || k}: ${String(v.from)} → ${String(v.to)}`).join(', ')}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Online players */}
        <div className="xl:col-span-2">
          <Card title={`Online players (${list.length}${place ? ` in ${d.places.find(p => p.key === place)?.label || place}` : ''})`} right={(
            <div className="flex items-center gap-2">
              {place && <button onClick={() => setPlace('')} className="rounded border border-gray-300 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50">Show all</button>}
              <input placeholder="Name or mobile" value={q} onChange={e => setQ(e.target.value.slice(0, 30))} className="w-36 rounded border border-gray-300 px-2 py-1 text-[11px]" />
            </div>
          )}>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 text-left text-[11px] uppercase text-gray-500">
                  <tr><th className="px-2 py-2">Player</th><th className="px-2 py-2">Where</th><th className="px-2 py-2">Device</th><th className="px-2 py-2 text-right">Here for</th><th className="px-2 py-2 text-right">Balance</th></tr>
                </thead>
                <tbody>
                  {list.length === 0 && <tr><td colSpan={5} className="px-2 py-8 text-center text-gray-400">No players online{place || q ? ' for this filter' : ' right now'}.</td></tr>}
                  {list.map(p => (
                    <tr key={p.mobile} className="border-t border-gray-100">
                      <td className="px-2 py-1.5"><PlayerCell name={p.name} mobile={p.mobile} onOpenUser={onOpenUser} /></td>
                      <td className="px-2 py-1.5">{p.whereLabel}</td>
                      <td className="px-2 py-1.5">{p.platform === 'android' ? <Pill tone="green">App</Pill> : <Pill tone="blue">Website</Pill>}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{since(p.since)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{p.balance == null ? '—' : inr(p.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <Card title="Busiest moment (last 7 days)">
          {d.peaks.length === 0 ? <p className="text-xs text-gray-400">No data yet.</p> : (
            <table className="w-full text-xs">
              <tbody>
                {d.peaks.map(p => (
                  <tr key={p.date} className="border-t border-gray-100 first:border-0">
                    <td className="py-1.5 font-semibold">{p.date}</td>
                    <td className="py-1.5 text-right font-bold tabular-nums">{p.total} online</td>
                    <td className="py-1.5 text-right text-gray-500">{istTime(p.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-[11px] text-gray-500">The most players online at the same time on each day.</p>
        </Card>
      </div>

      <Card title="Live bets feed" right={(
        <div className="flex items-center gap-1">
          {d.config.feed ? <Pill tone="green">Shown to players</Pill> : <Pill tone="grey">Off</Pill>}
          {(['latest', 'wins'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1 text-[11px] font-bold ${tab === t ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {t === 'latest' ? 'Latest bets' : 'Big wins'}
            </button>
          ))}
        </div>
      )}>
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 text-left text-[11px] uppercase text-gray-500">
              <tr><th className="px-2 py-2">Time</th><th className="px-2 py-2">Player</th><th className="px-2 py-2">Players see</th><th className="px-2 py-2">Game</th>
                <th className="px-2 py-2 text-right">Bet</th><th className="px-2 py-2 text-right">Multiplier</th><th className="px-2 py-2 text-right">Payout</th></tr>
            </thead>
            <tbody>
              {feed.length === 0 && <tr><td colSpan={7} className="px-2 py-8 text-center text-gray-400">{tab === 'latest' ? 'No bets in the last 7 days.' : 'No wins in the last 2 days.'}</td></tr>}
              {feed.map(e => (
                <tr key={`${tab}-${e.id}`} className="border-t border-gray-100">
                  <td className="px-2 py-1.5 text-gray-500">{istDateTime(e.at)}</td>
                  <td className="px-2 py-1.5"><PlayerCell name={e.user} mobile={e.mobile} onOpenUser={onOpenUser} /></td>
                  <td className="px-2 py-1.5 font-mono text-gray-500">{e.player}</td>
                  <td className="px-2 py-1.5"><b>{e.market || e.gameLabel}</b>{e.market && <span className="text-gray-500"> · {e.gameLabel}</span>} <span className="text-gray-500">{e.detail}</span></td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{inr(e.amount)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{e.multiplier == null ? '—' : `${e.multiplier.toFixed(2)}x`}</td>
                  <td className={`px-2 py-1.5 text-right font-bold tabular-nums ${e.status === 'won' ? 'text-emerald-700' : e.status === 'pending' ? 'text-blue-600' : 'text-gray-400'}`}>
                    {e.status === 'pending' ? 'In play' : e.status === 'won' ? `+${inr(e.payout)}` : `-${inr(e.amount)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-gray-500">Players see masked mobiles only. For Matka, 99x Matka and the trading games the feed never shows which numbers or options were picked.</p>
      </Card>
    </div>
  );
}
