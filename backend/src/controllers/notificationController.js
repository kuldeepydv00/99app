// Notifications API.
// Players: GET /api/user/notifications (their own + broadcasts, with unread count),
//          POST /api/user/notifications/seen (opened the bell: everything so far is read).
// Public:  GET /api/notifications — broadcasts only (shown to logged-out visitors).
// Admin:   POST /api/admin/send-notification — to all users, one user, or several mobiles.
// Phone notifications (web push, utils/webPush.js):
//          GET /api/push/public-key, POST /api/user/push/subscribe | unsubscribe, GET /api/admin/push/stats
const notify = require('../utils/notify');
const webPush = require('../utils/webPush');

const clean = m => String(m || '').replace(/[^0-9]/g, '').slice(-10);

exports.myNotifications = (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  res.json({ success: true, ...notify.forUser(req.authMobile, limit) });
};

exports.markSeen = (req, res) => {
  notify.markSeen(req.authMobile);
  res.json({ success: true, ...notify.forUser(req.authMobile, 1), notifications: undefined });
};

exports.publicNotifications = (req, res) => {
  res.json(notify.broadcastsOnly());
};

// target: 'All Users' (or empty) for everyone; otherwise one or more mobiles separated by commas / spaces.
exports.sendNotification = async (req, res) => {
  const { title, body, targetUser, target, mobiles } = req.body || {};
  const t = String(title || '').trim();
  const b = String(body || '').trim();
  if (!t || !b) return res.status(400).json({ success: false, message: 'Title and message are required' });

  const { registeredUsers, memoryNotifications } = require('../store');
  const raw = String(mobiles || targetUser || target || '').trim();
  const everyone = !raw || /^all/i.test(raw);

  if (everyone) {
    const n = notify.broadcast({ type: 'admin', title: t, body: b });
    try {
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState === 1) {
        const NotificationModel = mongoose.models.Notification || mongoose.model('Notification', new mongoose.Schema({}, { strict: false }));
        await NotificationModel.create(n).catch(() => {});
      }
    } catch (e) {}
    const io = req.app && req.app.get && req.app.get('io');
    if (io) io.emit('push_notification', n);
    return res.json({ success: true, message: `Sent to all users: "${t}"`, sentTo: 'all', notification: n, notifications: memoryNotifications });
  }

  const wanted = [...new Set(raw.split(/[\s,;]+/).map(clean).filter(m => m.length === 10))];
  if (!wanted.length) return res.status(400).json({ success: false, message: 'Enter "All Users" or valid 10-digit mobile numbers' });
  const known = new Set(registeredUsers.map(u => clean(u.mobile)));
  const found = wanted.filter(m => known.has(m));
  const missing = wanted.filter(m => !known.has(m));
  if (!found.length) return res.status(404).json({ success: false, message: `No user with ${missing.length === 1 ? 'this number' : 'these numbers'}: ${missing.join(', ')}` });
  const sent = found.map(m => notify.toUser(m, { type: 'admin', title: t, body: b })).filter(Boolean);
  res.json({
    success: true,
    message: `Sent to ${found.length} user${found.length === 1 ? '' : 's'}${missing.length ? ` (not found: ${missing.join(', ')})` : ''}`,
    sentTo: found, notFound: missing, notification: sent[0] || null, notifications: memoryNotifications
  });
};

// ---------- phone notifications (web push) ----------
exports.pushPublicKey = (req, res) => {
  try { res.json({ success: true, publicKey: webPush.publicKey() }); }
  catch (e) { res.status(500).json({ success: false, message: 'Phone notifications are not available right now' }); }
};

// body: { subscription: { endpoint, keys: { p256dh, auth } } } from the browser's pushManager.subscribe()
exports.pushSubscribe = (req, res) => {
  const sub = (req.body && (req.body.subscription || req.body)) || null;
  const r = webPush.subscribe(req.authMobile, sub, req.headers['user-agent']);
  if (!r.ok) return res.status(400).json({ success: false, message: r.message });
  res.json({ success: true, message: 'Phone notifications are on' });
};

exports.pushUnsubscribe = (req, res) => {
  const endpoint = String((req.body && req.body.endpoint) || '');
  const removed = endpoint ? webPush.unsubscribe(req.authMobile, endpoint) : 0;
  res.json({ success: true, removed });
};

exports.pushStats = (req, res) => {
  res.json({ success: true, ...webPush.summary() });
};
