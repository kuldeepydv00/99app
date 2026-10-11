// Phone notifications for the web app (Web Push), with no extra packages.
//
// A player who taps "Turn on phone notifications" on the website gives us a "subscription": an
// address at their browser's push service (Google for Chrome/Android, Apple for iPhone, Mozilla
// for Firefox, Microsoft for Edge) plus two keys. We send each message to that address,
// encrypted so only that phone can read it (RFC 8291), signed with our own server key (VAPID,
// RFC 8292). The phone shows it even when the web app is closed.
//
// Keys: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY from .env when set, otherwise made once and kept in
// dataStore.json (store.pushConfig). Keep the same keys forever: new keys make every phone that
// already turned notifications on stop receiving them until the player turns them on again.
// Subscriptions live in store.pushSubscriptions (saved in dataStore.json).
const crypto = require('crypto');
const https = require('https');

const cleanMobile = m => String(m || '').replace(/[^0-9]/g, '').slice(-10);
const b64u = buf => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = s => Buffer.from(String(s || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const MAX_PER_PLAYER = 5;      // phones / browsers per player
const MAX_TOTAL = 100000;
const SEND_AT_ONCE = 10;       // parallel sends
const DEFAULT_TTL = 24 * 3600; // a phone that's off for a day still gets it when it comes back

// We only ever send to the browsers' own push services (so nobody can make the server call other addresses)
const PUSH_HOSTS = ['fcm.googleapis.com', 'android.googleapis.com', 'updates.push.services.mozilla.com', 'push.services.mozilla.com', 'web.push.apple.com', 'push.apple.com', 'notify.windows.com'];
function allowedEndpoint(endpoint) {
  try {
    const u = new URL(String(endpoint));
    if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return false;
    const h = u.hostname.toLowerCase();
    return PUSH_HOSTS.some(p => h === p || h.endsWith('.' + p));
  } catch (e) { return false; }
}

function store() { return require('../store'); }
function save() { const s = store(); if (typeof s.scheduleSave === 'function') s.scheduleSave(); }

// ---------- server keys (VAPID) ----------
function makeKeys() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return { publicKey: b64u(ecdh.getPublicKey()), privateKey: b64u(ecdh.getPrivateKey()) };
}

let cachedKeys = null;
function keys() {
  if (cachedKeys) return cachedKeys;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    cachedKeys = { publicKey: process.env.VAPID_PUBLIC_KEY.trim(), privateKey: process.env.VAPID_PRIVATE_KEY.trim() };
    return cachedKeys;
  }
  const s = store();
  const cfg = s.pushConfig;
  if (!cfg.publicKey || !cfg.privateKey) {
    Object.assign(cfg, makeKeys(), { createdAt: new Date().toISOString() });
    if (typeof s.saveDiskStore === 'function') s.saveDiskStore(); // saved straight away: the keys must never change
  }
  cachedKeys = { publicKey: cfg.publicKey, privateKey: cfg.privateKey };
  return cachedKeys;
}
function publicKey() { return keys().publicKey; }
function subject() { return (process.env.VAPID_SUBJECT || 'https://newmatkadomain.com').trim(); }

let signingKey = null;
function privateKeyObject() {
  if (signingKey) return signingKey;
  const { publicKey: pub, privateKey: priv } = keys();
  const p = fromB64u(pub);
  signingKey = crypto.createPrivateKey({
    key: { kty: 'EC', crv: 'P-256', d: b64u(fromB64u(priv)), x: b64u(p.subarray(1, 33)), y: b64u(p.subarray(33, 65)) },
    format: 'jwk'
  });
  return signingKey;
}

// "vapid t=<signed token>, k=<our public key>", reused for 11 hours per push service
const tokenCache = new Map();
function vapidAuth(endpoint, now = Date.now()) {
  const aud = new URL(endpoint).origin;
  const hit = tokenCache.get(aud);
  if (hit && hit.until > now) return hit.value;
  const exp = Math.floor(now / 1000) + 12 * 3600;
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({ aud, exp, sub: subject() }));
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key: privateKeyObject(), dsaEncoding: 'ieee-p1363' });
  const value = `vapid t=${head}.${body}.${b64u(sig)}, k=${publicKey()}`;
  tokenCache.set(aud, { value, until: now + 11 * 3600 * 1000 });
  return value;
}

// ---------- message encryption (RFC 8291, "aes128gcm") ----------
// test: lets the tests fix the random parts to check against the RFC's worked example
function encrypt(payload, p256dh, auth, test = {}) {
  const uaPublic = fromB64u(p256dh);
  const authSecret = fromB64u(auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error('Bad subscription key');
  if (authSecret.length < 16) throw new Error('Bad subscription secret');
  const ecdh = crypto.createECDH('prime256v1');
  if (test.asPrivate) ecdh.setPrivateKey(fromB64u(test.asPrivate)); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);
  const salt = test.salt ? fromB64u(test.salt) : crypto.randomBytes(16);

  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, authSecret, keyInfo, 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));

  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const data = Buffer.concat([Buffer.from(payload), Buffer.from([2])]); // 2 = last (only) record
  const sealed = Buffer.concat([cipher.update(data), cipher.final(), cipher.getAuthTag()]);

  const header = Buffer.alloc(16 + 4 + 1);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header[20] = asPublic.length;
  return Buffer.concat([header, asPublic, sealed]);
}

// ---------- sending ----------
function httpPost(endpoint, headers, body) {
  return new Promise(resolve => {
    try {
      const req = https.request(endpoint, { method: 'POST', headers: { ...headers, 'Content-Length': body.length }, timeout: 10000 }, res => {
        res.resume();
        res.on('end', () => resolve({ status: res.statusCode }));
      });
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', err => resolve({ status: 0, error: err.message }));
      req.end(body);
    } catch (e) { resolve({ status: 0, error: e.message }); }
  });
}
let transport = httpPost;

async function sendOne(sub, message, opts = {}) {
  const payload = JSON.stringify(message);
  const body = encrypt(payload, sub.keys.p256dh, sub.keys.auth);
  const headers = {
    TTL: String(opts.ttl || DEFAULT_TTL),
    Urgency: opts.urgency || 'normal',
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    Authorization: vapidAuth(sub.endpoint)
  };
  if (opts.topic) headers.Topic = String(opts.topic).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
  const r = await transport(sub.endpoint, headers, body);
  // 404 / 410: the player turned notifications off or the browser dropped the subscription
  return { ok: r.status >= 200 && r.status < 300, gone: r.status === 404 || r.status === 410, status: r.status, error: r.error };
}

function list() { return store().pushSubscriptions; }

let queue = Promise.resolve();
const stats = { sent: 0, failed: 0, removed: 0, lastError: null };

// Sends to these subscriptions in the background (never throws, never slows the caller down)
function deliver(subs, message, opts) {
  if (!subs.length) return Promise.resolve({ sent: 0, failed: 0, removed: 0 });
  const job = queue.then(async () => {
    const out = { sent: 0, failed: 0, removed: 0 };
    const gone = new Set();
    for (let i = 0; i < subs.length; i += SEND_AT_ONCE) {
      await Promise.all(subs.slice(i, i + SEND_AT_ONCE).map(async sub => {
        try {
          const r = await sendOne(sub, message, opts);
          if (r.ok) { out.sent += 1; sub.lastOkAt = new Date().toISOString(); }
          else if (r.gone) gone.add(sub.endpoint);
          else { out.failed += 1; stats.lastError = r.error || `HTTP ${r.status}`; }
        } catch (e) { out.failed += 1; stats.lastError = e.message; }
      }));
    }
    if (gone.size) {
      const all = list();
      for (let i = all.length - 1; i >= 0; i--) if (gone.has(all[i].endpoint)) all.splice(i, 1);
      out.removed = gone.size;
      save();
    }
    stats.sent += out.sent; stats.failed += out.failed; stats.removed += out.removed;
    return out;
  });
  queue = job.catch(() => {});
  return job;
}

// What the phone shows. url: the page that opens when the player taps it.
function message({ title, body, type = 'info', url = '/', tag } = {}) {
  return {
    title: String(title || '99xmatka').slice(0, 120),
    body: String(body || '').slice(0, 300),
    type, url, tag: tag || undefined,
    icon: '/icons/icon-192.png', badge: '/icons/badge-96.png'
  };
}

function toMobile(mobile, msg, opts = {}) {
  const m = cleanMobile(mobile);
  if (m.length !== 10) return Promise.resolve({ sent: 0, failed: 0, removed: 0 });
  return deliver(list().filter(s => s.mobile === m), message({ url: '/?open=notifications', ...msg }), { urgency: 'high', ...opts });
}

function toAll(msg, opts = {}) {
  return deliver(list().slice(), message(msg), opts);
}

// ---------- subscriptions ----------
function validSubscription(sub) {
  return !!(sub && typeof sub.endpoint === 'string' && sub.endpoint.length < 1000 && allowedEndpoint(sub.endpoint)
    && sub.keys && fromB64u(sub.keys.p256dh).length === 65 && fromB64u(sub.keys.auth).length >= 16);
}

function subscribe(mobile, sub, userAgent = '') {
  const m = cleanMobile(mobile);
  if (m.length !== 10) return { ok: false, message: 'Invalid account' };
  if (!validSubscription(sub)) return { ok: false, message: 'This browser gave an invalid notification address' };
  const all = list();
  const at = all.findIndex(s => s.endpoint === sub.endpoint);
  if (at >= 0) all.splice(at, 1); // same phone, maybe a different player now
  all.unshift({
    endpoint: sub.endpoint, keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) },
    mobile: m, ua: String(userAgent || '').slice(0, 160), createdAt: new Date().toISOString()
  });
  // keep each player's newest few phones, and an overall cap
  let mine = 0;
  for (let i = 0; i < all.length; i++) {
    if (all[i].mobile === m && ++mine > MAX_PER_PLAYER) { all.splice(i, 1); i -= 1; }
  }
  if (all.length > MAX_TOTAL) all.length = MAX_TOTAL;
  save();
  return { ok: true };
}

function unsubscribe(mobile, endpoint) {
  const m = cleanMobile(mobile);
  const all = list();
  const before = all.length;
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i].endpoint === endpoint && all[i].mobile === m) all.splice(i, 1);
  }
  if (all.length !== before) save();
  return before - all.length;
}

// Account deleted: forget all of that player's phones
function forgetMobile(mobile) {
  const m = cleanMobile(mobile);
  const all = list();
  const before = all.length;
  for (let i = all.length - 1; i >= 0; i--) if (all[i].mobile === m) all.splice(i, 1);
  if (all.length !== before) save();
  return before - all.length;
}

function summary() {
  const all = list();
  return { phones: all.length, players: new Set(all.map(s => s.mobile)).size, sent: stats.sent, failed: stats.failed, removed: stats.removed, lastError: stats.lastError };
}

module.exports = {
  publicKey, subscribe, unsubscribe, forgetMobile, toMobile, toAll, summary, allowedEndpoint,
  // tests
  _encrypt: encrypt, _vapidAuth: vapidAuth, _setTransport: fn => { transport = fn || httpPost; },
  _reset: () => { cachedKeys = null; signingKey = null; tokenCache.clear(); queue = Promise.resolve(); Object.assign(stats, { sent: 0, failed: 0, removed: 0, lastError: null }); },
  _flush: () => queue
};
