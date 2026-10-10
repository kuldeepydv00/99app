import { useEffect, useRef, useState } from 'react';
import { Bell, X, Wallet, Landmark, Undo2, Trophy, Megaphone, Target, Info } from 'lucide-react';
import type { ComponentType } from 'react';
import { gamesGet, gamesPost } from '../games/api';

// Notifications: the player's own messages (deposits, withdrawals, wins, refunds, admin messages)
// plus announcements for everyone. Logged out: announcements only.

export type Note = {
  id: string; type: string; title: string; body: string; amount: number | null;
  personal: boolean; createdAt: string; unread: boolean;
};
type Mine = { success: boolean; unread: number; notifications: Note[] };

const hasToken = () => { try { return !!localStorage.getItem('99x_web_token'); } catch { return false; } };
const POLL_MS = 15000;

function toNotes(list: any[]): Note[] {
  return (list || []).map((n: any) => ({
    id: String(n.id || n._id || Math.random()), type: String(n.type || 'info'), title: n.title || 'Notification',
    body: n.body || n.message || '', amount: n.amount ?? null, personal: !!n.personal,
    createdAt: n.createdAt || n.created_at || new Date().toISOString(), unread: !!n.unread
  }));
}

/** Loads and refreshes the bell (every 15 s while the tab is open). */
export function useNotifications(loggedIn: boolean) {
  const [list, setList] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<Note | null>(null);
  const known = useRef<Set<string> | null>(null);

  const load = async () => {
    try {
      if (loggedIn && hasToken()) {
        const r = await gamesGet<Mine>('/api/user/notifications?limit=60');
        const notes = toNotes(r.notifications);
        // a new personal message since the last check pops up for a few seconds
        if (known.current) {
          const fresh = notes.find(n => n.personal && n.unread && !known.current!.has(n.id));
          if (fresh) setToast(fresh);
        }
        known.current = new Set(notes.map(n => n.id));
        setList(notes);
        setUnread(r.unread || 0);
      } else {
        const r = await gamesGet<any[]>('/api/notifications');
        const notes = toNotes(Array.isArray(r) ? r : []).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 30);
        known.current = null;
        setList(notes);
        setUnread(0);
      }
    } catch { /* keep what we have */ }
  };

  useEffect(() => {
    known.current = null;
    load();
    const id = window.setInterval(() => { if (document.visibilityState !== 'hidden') load(); }, POLL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(id);
  }, [toast]);

  /** The bell was opened: everything shown so far counts as read. */
  const markSeen = async () => {
    if (!loggedIn || !hasToken() || unread === 0) return;
    setUnread(0);
    try { await gamesPost('/api/user/notifications/seen', {}); } catch { /* next poll will correct it */ }
    setList(l => l.map(n => ({ ...n, unread: false })));
  };

  return { list, unread, toast, closeToast: () => setToast(null), markSeen, reload: load };
}

const ICON: Record<string, { Icon: ComponentType<{ className?: string }>; tone: string }> = {
  deposit: { Icon: Wallet, tone: 'bg-nv-green/15 text-nv-green' },
  withdrawal: { Icon: Landmark, tone: 'bg-nv-blue/15 text-nv-blue2' },
  refund: { Icon: Undo2, tone: 'bg-amber-400/15 text-amber-300' },
  win: { Icon: Trophy, tone: 'bg-nv-gold/15 text-nv-gold' },
  wallet: { Icon: Wallet, tone: 'bg-nv-blue/15 text-nv-blue2' },
  admin: { Icon: Megaphone, tone: 'bg-fuchsia-400/15 text-fuchsia-300' },
  CUSTOM_BROADCAST: { Icon: Megaphone, tone: 'bg-fuchsia-400/15 text-fuchsia-300' },
  RESULT_ANNOUNCED: { Icon: Target, tone: 'bg-nv-red/15 text-nv-red' }
};
const iconOf = (t: string) => ICON[t] || { Icon: Info, tone: 'bg-white/10 text-nv-text' };

function ago(iso: string) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}

function Row({ n }: { n: Note }) {
  const { Icon, tone } = iconOf(n.type);
  return (
    <div className={`flex gap-3 rounded-lg px-3 py-3 ${n.unread ? 'bg-nv-card2/70' : 'bg-nv-input/60'}`}>
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}><Icon className="h-[18px] w-[18px]" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-[13.5px] font-semibold leading-snug text-white">{n.title}</p>
          {n.unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-nv-blue2" aria-label="New" />}
        </div>
        {n.body && <p className="mt-0.5 text-[12.5px] leading-relaxed text-nv-text">{n.body}</p>}
        <p className="mt-1 text-[11px] text-nv-dim">{ago(n.createdAt)}{!n.personal ? ' · For everyone' : ''}</p>
      </div>
    </div>
  );
}

/** The notifications panel (opened from the bell). */
export function NotificationsPanel({ list, loggedIn, onClose }: { list: Note[]; loggedIn: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const shown = tab === 'mine' ? list.filter(n => n.personal) : list;
  return (
    <div className="nv-fade fixed inset-0 z-[60] flex items-end justify-center bg-black/70 font-nv sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-nv-panel shadow-2xl ring-1 ring-white/5 sm:rounded-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-black/30 px-4 py-3.5">
          <Bell className="h-5 w-5 text-nv-gold" />
          <h3 className="flex-1 text-[15px] font-bold text-white">Notifications</h3>
          <button onClick={onClose} aria-label="Close" className="nv-tap flex h-8 w-8 items-center justify-center rounded-md text-nv-mute hover:bg-nv-card2 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        {loggedIn && (
          <div className="flex gap-1 px-4 pt-3">
            {([['all', 'All'], ['mine', 'My wallet & wins']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`nv-tap rounded-full px-3 py-1.5 text-[12px] font-semibold ${tab === k ? 'bg-nv-card2 text-white' : 'text-nv-text hover:text-white'}`}>{l}</button>
            ))}
          </div>
        )}
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {shown.length === 0 ? (
            <div className="py-10 text-center">
              <Bell className="mx-auto mb-2 h-8 w-8 text-nv-dim" />
              <p className="text-[13px] text-nv-mute">{loggedIn ? 'No notifications yet. Deposits, withdrawals, wins and announcements will show here.' : 'Log in to see your deposits, withdrawals and wins here.'}</p>
            </div>
          ) : shown.map(n => <Row key={n.id} n={n} />)}
        </div>
      </div>
    </div>
  );
}

/** A new personal message pops up at the top for a few seconds. */
export function NotificationToast({ note, onOpen, onClose }: { note: Note | null; onOpen: () => void; onClose: () => void }) {
  if (!note) return null;
  const { Icon, tone } = iconOf(note.type);
  return (
    <div className="nv-fade fixed inset-x-0 top-3 z-[70] flex justify-center px-3 font-nv">
      <div className="flex w-full max-w-sm items-start gap-3 rounded-xl bg-nv-card2 px-3.5 py-3 shadow-2xl ring-1 ring-white/10">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}><Icon className="h-[18px] w-[18px]" /></span>
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="text-[13.5px] font-semibold leading-snug text-white">{note.title}</p>
          {note.body && <p className="mt-0.5 line-clamp-2 text-[12px] text-nv-text">{note.body}</p>}
        </button>
        <button onClick={onClose} aria-label="Close" className="text-nv-mute hover:text-white"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
