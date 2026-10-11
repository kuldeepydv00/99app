// Notifications for players.
//
// Two kinds, both kept in store.memoryNotifications (saved in dataStore.json):
// - personal: for one player only (`mobile` set): deposit added, withdrawal paid / refunded,
//   Matka and 99x Matka wins, money added or taken by the admin, bets refunded.
// - broadcast: for everyone (`mobile` not set, target 'All Users'): admin announcements, results.
// A player only ever receives the broadcasts plus their own personal messages.
// Read state: the time each player last opened the bell (store.notificationSeen); anything newer is unread.
const cleanMobile = m => String(m || '').replace(/[^0-9]/g, '').slice(-10);
const inr = n => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const ms = v => { const t = new Date(v).getTime(); return Number.isFinite(t) ? t : 0; };

const KEEP_PERSONAL_DAYS = 60;
const KEEP_BROADCASTS = 300;
const MAX_TOTAL = 5000;

let seq = 0;
const newId = () => `notif_${Date.now()}_${(seq = (seq + 1) % 100000)}_${Math.floor(Math.random() * 1000)}`;

function store() { return require('../store'); }
// Each message also goes to the player's phone when they turned on phone notifications (web push)
function phone() { return require('./webPush'); }

// A stored notification is personal when it names one 10-digit mobile.
function ownerOf(n) {
  if (!n) return '';
  if (n.mobile) return cleanMobile(n.mobile);
  const t = cleanMobile(n.target);
  return t.length === 10 ? t : '';
}

function prune() {
  const list = store().memoryNotifications;
  const cutoff = Date.now() - KEEP_PERSONAL_DAYS * 86400000;
  let broadcasts = 0;
  for (let i = 0; i < list.length; i++) {
    const n = list[i];
    const personal = !!ownerOf(n);
    const drop = (personal && ms(n.createdAt) && ms(n.createdAt) < cutoff) || (!personal && ++broadcasts > KEEP_BROADCASTS) || i >= MAX_TOTAL;
    if (drop) { list.splice(i, 1); i -= 1; }
  }
}

function add(n) {
  const s = store();
  s.memoryNotifications.unshift(n);
  prune();
  if (typeof s.scheduleSave === 'function') s.scheduleSave();
  return n;
}

// One player. Returns the notification (or null for an unusable mobile). Never throws.
function toUser(mobile, { type = 'info', title, body, amount = null, ref = null } = {}) {
  try {
    const m = cleanMobile(mobile);
    if (m.length !== 10 || !title) return null;
    const id = newId();
    const n = add({
      _id: id, id, type, title: String(title).slice(0, 120), body: String(body || '').slice(0, 500),
      mobile: m, target: m, amount: amount === null ? null : Number(amount) || 0, ref,
      createdAt: new Date().toISOString()
    });
    try { phone().toMobile(m, { title: n.title, body: n.body, type, tag: id }); } catch (e) { /* the bell still has it */ }
    return n;
  } catch (e) {
    console.error('[Notify]', e.message);
    return null;
  }
}

// Everyone.
function broadcast({ type = 'admin', title, body, by = 'admin' } = {}) {
  const id = newId();
  const n = add({
    _id: id, id, type, title: String(title || '').slice(0, 120), body: String(body || '').slice(0, 500),
    target: 'All Users', by, createdAt: new Date().toISOString()
  });
  try { phone().toAll({ title: n.title, body: n.body, type, url: '/?open=notifications', tag: id }); } catch (e) { /* ignore */ }
  return n;
}

// Adds amounts per player inside a loop, then sends one message each (e.g. one "you won" per result).
function perPlayer() {
  const map = new Map();
  return {
    add(mobile, amount, item) {
      const m = cleanMobile(mobile);
      if (m.length !== 10) return;
      const e = map.get(m) || { amount: 0, count: 0, items: [] };
      e.amount = Math.round((e.amount + (Number(amount) || 0)) * 100) / 100;
      e.count += 1;
      if (item !== undefined && e.items.length < 5) e.items.push(item);
      map.set(m, e);
    },
    send(make) {
      let sent = 0;
      for (const [m, e] of map) { const msg = make(e, m); if (msg && toUser(m, msg)) sent += 1; }
      return sent;
    }
  };
}

// What one player sees: their own messages and the broadcasts, newest first.
function forUser(mobile, limit = 50) {
  const m = cleanMobile(mobile);
  const s = store();
  const seenAt = Number((s.notificationSeen || {})[m]) || 0;
  const list = s.memoryNotifications
    .filter(n => { const o = ownerOf(n); return o ? o === m : true; })
    .sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
  const unread = list.filter(n => ms(n.createdAt) > seenAt).length;
  return {
    unread,
    seenAt: seenAt ? new Date(seenAt).toISOString() : null,
    notifications: list.slice(0, Math.min(100, Math.max(1, limit))).map(n => ({
      id: n.id || n._id, type: n.type || 'info', title: n.title, body: n.body, amount: n.amount ?? null,
      personal: !!ownerOf(n), createdAt: n.createdAt, unread: ms(n.createdAt) > seenAt
    }))
  };
}

function markSeen(mobile, at = Date.now()) {
  const m = cleanMobile(mobile);
  const s = store();
  if (m.length !== 10 || !s.notificationSeen) return;
  s.notificationSeen[m] = at;
  if (typeof s.scheduleSave === 'function') s.scheduleSave();
}

// Only broadcasts: for the old public endpoint (older app versions), so nobody sees another player's messages.
function broadcastsOnly() {
  return store().memoryNotifications.filter(n => !ownerOf(n));
}

module.exports = { toUser, broadcast, perPlayer, forUser, markSeen, broadcastsOnly, ownerOf, inr, cleanMobile };
