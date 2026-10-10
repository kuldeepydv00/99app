// A short-lived copy of the MongoDB collections the admin pages read.
//
// Memory (dataStore.json) is the main copy of all data; MongoDB is a backup mirror. The admin pages
// still look at MongoDB for records that only exist there (older data, or another server writing to
// the same database), but they used to read whole collections on every request, every 4 seconds.
// Now each collection is read at most once a minute, in the background: a request gets the last copy
// at once and, if it is older than a minute, a fresh read starts for the next request.
const TTL_MS = 60 * 1000;

function models() {
  return {
    User: require('../models/User'),
    Bet: require('../models/Bet'),
    DepositRequest: require('../models/DepositRequest'),
    WithdrawalRequest: require('../models/WithdrawalRequest'),
    Transaction: require('../models/Transaction'),
    ResultRecord: require('../models/ResultRecord'),
    PaymentMethod: require('../models/PaymentMethod')
  };
}

const LOADERS = {
  users: m => m.User.find({}).lean(),
  bets: m => m.Bet.find({}).sort({ createdAt: -1 }).lean(),
  pendingBets: m => m.Bet.find({ status: 'pending' }).lean(),
  deposits: m => m.DepositRequest.find().sort({ createdAt: -1 }).lean(),
  withdrawals: m => m.WithdrawalRequest.find().sort({ createdAt: -1 }).lean(),
  txDeposits: m => m.Transaction.find({ type: 'deposit' }).lean(),
  txWithdrawals: m => m.Transaction.find({ type: 'withdrawal' }).lean(),
  results: m => m.ResultRecord.find().sort({ date_key: -1, declared_at: -1 }).limit(100).lean(),
  paymentMethods: m => m.PaymentMethod.find().sort({ updatedAt: -1 }).lean(),
  notifications: () => {
    const mongoose = require('mongoose');
    const N = mongoose.models.Notification || mongoose.model('Notification', new mongoose.Schema({}, { strict: false }));
    return N.find().sort({ createdAt: -1 }).limit(50).lean();
  }
};

const entries = new Map(); // key -> { data, at, version, loading }

function ready() {
  try { return require('mongoose').connection.readyState === 1; } catch (e) { return false; }
}

function load(key) {
  let e = entries.get(key);
  if (!e) { e = { data: null, at: 0, version: 0, loading: null }; entries.set(key, e); }
  if (e.loading) return e.loading;
  const started = Date.now();
  e.loading = Promise.resolve()
    .then(() => LOADERS[key](models()))
    .then(data => {
      e.data = Array.isArray(data) ? data : [];
      e.at = Date.now();
      e.version += 1;
      const took = Date.now() - started;
      if (took > 3000) console.log(`[Mongo cache] ${key}: ${e.data.length} records in ${took} ms`);
    })
    .catch(err => { console.error(`[Mongo cache] ${key}:`, err.message); e.at = Date.now(); })
    .finally(() => { e.loading = null; });
  return e.loading;
}

// Returns { key: [records] } for the asked collections, or null when MongoDB is not connected.
// The first call for a collection waits for it; after that, the last copy comes back at once.
async function snapshot(keys, ttlMs = TTL_MS) {
  if (!ready()) return null;
  const waits = [];
  for (const k of keys) {
    if (!LOADERS[k]) throw new Error(`Unknown collection ${k}`);
    const e = entries.get(k);
    if (!e || e.data === null) waits.push(load(k));
    else if (Date.now() - e.at > ttlMs) load(k); // refresh in the background
  }
  if (waits.length) await Promise.all(waits);
  const out = {};
  for (const k of keys) out[k] = (entries.get(k) && entries.get(k).data) || [];
  return out;
}

// Changes every time a fresh copy of that collection arrives (used to skip work when nothing changed).
function version(key) { const e = entries.get(key); return e ? e.version : 0; }

// Forget a copy so the next request reads it again (e.g. after a write that must show up at once).
function invalidate(...keys) { for (const k of keys) { const e = entries.get(k); if (e) e.at = 0; } }

function _reset() { entries.clear(); }

// Read every collection once in the background (called when the server connects to MongoDB),
// so the first admin page after a restart doesn't have to wait for them.
function warm() {
  if (!ready()) return Promise.resolve(null);
  const started = Date.now();
  return snapshot(Object.keys(LOADERS))
    .then(() => console.log(`[Mongo cache] ready in ${Date.now() - started} ms`))
    .catch(err => console.error('[Mongo cache] warm-up:', err.message));
}

module.exports = { snapshot, version, invalidate, ready, warm, TTL_MS, _reset };
