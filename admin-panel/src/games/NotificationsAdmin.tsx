import { useMemo, useState } from 'react';
import { API_BASE, apiGet, apiPost, usePolling, Card, Kpi, Pill, istDateTime } from './common';
import type { OpenUser } from './common';

// Push notifications: send a custom message to all users, one user or several users, and see every
// message players got — sent by the admin or automatic (deposits, withdrawals, wins, refunds, wallet changes).
type Notif = { _id?: string; id?: string; type?: string; title: string; body?: string; message?: string; target?: string; mobile?: string; amount?: number | null; createdAt?: string };

const AUTO_TYPES: Record<string, { label: string; tone: 'green' | 'blue' | 'gold' | 'red' | 'grey' }> = {
  deposit: { label: 'Deposit', tone: 'green' },
  withdrawal: { label: 'Withdrawal', tone: 'blue' },
  refund: { label: 'Refund', tone: 'gold' },
  win: { label: 'Win', tone: 'gold' },
  wallet: { label: 'Wallet change', tone: 'blue' },
  RESULT_ANNOUNCED: { label: 'Result', tone: 'red' }
};
const isAdminMsg = (n: Notif) => n.type === 'admin' || n.type === 'CUSTOM_BROADCAST' || !n.type;
const ownerOf = (n: Notif) => {
  const m = String(n.mobile || n.target || '').replace(/[^0-9]/g, '').slice(-10);
  return m.length === 10 ? m : '';
};

const TEMPLATES = [
  { title: '🎁 Deposit bonus today', body: 'Deposit today and get extra bonus in your wallet. Offer ends at midnight.' },
  { title: '⚙️ Short maintenance', body: 'The app will be under maintenance for 10 minutes. Your balance and bets are safe.' },
  { title: '📢 Result update', body: 'Today\'s results are out. Open the app to check your bets.' }
];

export default function NotificationsAdmin({ initial = [], onOpenUser }: { initial?: Notif[]; onOpenUser?: OpenUser }) {
  const [list, setList] = useState<Notif[]>(initial);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [to, setTo] = useState<'all' | 'one' | 'many'>('all');
  const [mobiles, setMobiles] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [filter, setFilter] = useState<'all' | 'admin' | 'auto'>('all');
  const [search, setSearch] = useState('');

  const load = usePolling(async () => {
    try {
      const data = await apiGet<Notif[]>('/api/admin/notifications');
      setList(Array.isArray(data) ? data : []);
      setError('');
    } catch (e: any) { setError(e.message); }
  }, 20000);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    if (to !== 'all' && !mobiles.trim()) { setNote({ ok: false, text: 'Enter the mobile number(s).' }); return; }
    if (to === 'all' && !window.confirm(`Send "${title.trim()}" to ALL users?`)) return;
    setBusy(true); setNote(null);
    try {
      const r = await apiPost<{ message: string }>('/api/admin/send-notification', to === 'all'
        ? { title: title.trim(), body: body.trim(), targetUser: 'All Users' }
        : { title: title.trim(), body: body.trim(), mobiles: mobiles.trim() });
      setNote({ ok: true, text: `✅ ${r.message}` });
      setTitle(''); setBody(''); setMobiles('');
      await load();
    } catch (err: any) { setNote({ ok: false, text: `⚠️ ${err.message}` }); }
    setBusy(false);
  };

  const remove = async (n: Notif) => {
    if (!window.confirm('Delete this notification? Players will no longer see it.')) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/notifications/${encodeURIComponent(String(n._id || n.id))}`, { method: 'DELETE' });
      if (res.ok) setList(prev => prev.filter(x => (x._id || x.id) !== (n._id || n.id)));
    } catch { /* ignore */ }
  };

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const istDay = (iso?: string) => (iso ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(iso)) : '');
  const stats = useMemo(() => {
    const t = list.filter(n => istDay(n.createdAt) === today);
    return {
      today: t.length,
      admin: list.filter(isAdminMsg).length,
      auto: list.filter(n => !isAdminMsg(n)).length,
      personalToday: t.filter(n => ownerOf(n)).length
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  const q = search.replace(/[^0-9a-z ]/gi, '').trim().toLowerCase();
  const rows = list
    .filter(n => filter === 'all' || (filter === 'admin' ? isAdminMsg(n) : !isAdminMsg(n)))
    .filter(n => !q || ownerOf(n).includes(q) || String(n.title).toLowerCase().includes(q))
    .sort((a, b) => +new Date(b.createdAt || 0) - +new Date(a.createdAt || 0))
    .slice(0, 300);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#DEE2E6] bg-white p-4 shadow-sm">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#212529]"><span>🔔</span>Push Notifications</h1>
        <p className="mt-1 text-xs text-gray-500">
          Players see these in the bell on the website and as phone notifications in the app. Deposits, withdrawals, refunds,
          Matka / 99x Matka wins and wallet changes are sent automatically; each player only sees their own.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Sent today" value={stats.today} sub={`${stats.personalToday} to single players`} accent />
        <Kpi label="Admin messages" value={stats.admin} sub="sent from this page" />
        <Kpi label="Automatic messages" value={stats.auto} sub="deposits, withdrawals, wins…" />
        <Kpi label="Kept for" value="60 days" sub="for messages to one player" />
      </div>

      <Card title="📣 Send a notification">
        <form onSubmit={send} className="space-y-3 text-xs">
          <div className="flex flex-wrap gap-2">
            {([['all', '📢 All users'], ['one', '👤 One user'], ['many', '👥 Several users']] as const).map(([k, l]) => (
              <button type="button" key={k} onClick={() => setTo(k)}
                className={`rounded-full border px-3 py-1.5 font-bold ${to === k ? 'border-[#007BFF] bg-[#007BFF] text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}>{l}</button>
            ))}
          </div>
          {to !== 'all' && (
            <label className="block">
              <span className="mb-1 block font-bold text-[#495057]">{to === 'one' ? 'Mobile number' : 'Mobile numbers (separate with commas or spaces)'}</span>
              <input value={mobiles} onChange={e => setMobiles(e.target.value)} inputMode="tel"
                placeholder={to === 'one' ? '98XXXXXXXX' : '98XXXXXXXX, 97XXXXXXXX'}
                className="w-full rounded border border-[#CED4DA] p-2 font-mono focus:border-[#007BFF] focus:outline-none" />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block font-bold text-[#495057]">Title *</span>
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} required placeholder="e.g. 🎉 Special deposit bonus today"
              className="w-full rounded border border-[#CED4DA] p-2 focus:border-[#007BFF] focus:outline-none" />
          </label>
          <label className="block">
            <span className="mb-1 block font-bold text-[#495057]">Message *</span>
            <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={500} rows={3} required placeholder="Write the message players will read"
              className="w-full rounded border border-[#CED4DA] p-2 focus:border-[#007BFF] focus:outline-none" />
            <span className="mt-0.5 block text-right text-[10px] text-gray-400">{body.length}/500</span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-500">Quick fill:</span>
            {TEMPLATES.map(t => (
              <button type="button" key={t.title} onClick={() => { setTitle(t.title); setBody(t.body); }}
                className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-100">{t.title}</button>
            ))}
          </div>
          {(title || body) && (
            <div className="rounded-lg bg-[#0F1923] p-3 text-white">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[#8DA2B5]">Preview</div>
              <div className="mt-1 text-[13px] font-semibold">{title || 'Title'}</div>
              <div className="text-[12px] text-[#B1BAD3]">{body || 'Message'}</div>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-3">
            {note && <span className={`font-semibold ${note.ok ? 'text-emerald-700' : 'text-red-700'}`}>{note.text}</span>}
            <button type="submit" disabled={busy} className="rounded bg-[#28A745] px-5 py-2 font-bold text-white shadow hover:bg-[#218838] disabled:opacity-50">
              {busy ? 'Sending…' : to === 'all' ? '🚀 Send to all users' : '🚀 Send'}
            </button>
          </div>
        </form>
      </Card>

      <Card title={`Notification history (${rows.length}${rows.length === 300 ? '+' : ''})`} right={(
        <div className="flex flex-wrap items-center gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Mobile or title" className="w-36 rounded border border-gray-300 px-2 py-1 text-xs" />
          {([['all', 'All'], ['admin', 'Sent by admin'], ['auto', 'Automatic']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`rounded border px-2.5 py-1 text-xs font-bold ${filter === k ? 'border-[#007BFF] bg-[#007BFF] text-white' : 'border-gray-300 bg-white text-gray-700'}`}>{l}</button>
          ))}
        </div>
      )}>
        {error && <p className="mb-2 text-xs font-semibold text-red-700">⚠️ {error}</p>}
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-gray-50 text-[11px] uppercase text-gray-500">
              <tr><th className="px-2 py-2">When</th><th className="px-2 py-2">To</th><th className="px-2 py-2">Kind</th><th className="px-2 py-2">Message</th><th className="px-2 py-2 text-right" /></tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-gray-400">No notifications yet.</td></tr>
              ) : rows.map(n => {
                const owner = ownerOf(n);
                const kind = isAdminMsg(n) ? { label: 'Admin', tone: 'grey' as const } : (AUTO_TYPES[String(n.type)] || { label: String(n.type), tone: 'grey' as const });
                return (
                  <tr key={String(n._id || n.id)} className="border-t border-gray-100 align-top">
                    <td className="whitespace-nowrap px-2 py-2 text-gray-500">{istDateTime(n.createdAt || '')}</td>
                    <td className="whitespace-nowrap px-2 py-2">{owner
                      ? (onOpenUser ? <button onClick={() => onOpenUser(owner)} title="Open user details" className="font-mono text-[#007BFF] hover:underline">{owner}</button> : <span className="font-mono">{owner}</span>)
                      : <Pill tone="green">All users</Pill>}</td>
                    <td className="px-2 py-2"><Pill tone={kind.tone}>{kind.label}</Pill></td>
                    <td className="px-2 py-2">
                      <div className="font-semibold text-gray-900">{n.title}</div>
                      <div className="text-gray-600">{n.body || n.message}</div>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button onClick={() => remove(n)} className="rounded bg-[#DC3545] px-2 py-1 text-[10px] font-bold text-white hover:bg-[#C82333]">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
