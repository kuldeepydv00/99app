// Rules that keep the in-memory store (saved to dataStore.json) the single source of truth.
//
// MongoDB is a MIRROR: the server writes to it, but it must never overwrite balances or
// request statuses in memory, and it must never bring back an account the admin deleted.
// Reading old values back from MongoDB is what made deleted users, rejected deposits and
// old balances "come back", and what created duplicate withdrawal requests.
const cleanMobile = m => String(m || '').replace(/[^0-9]/g, '').slice(-10);
const round2 = n => parseFloat((Number(n) || 0).toFixed(2));
const isObjectId = v => /^[0-9a-f]{24}$/i.test(String(v || ''));

function mongoReady() {
  try { return require('mongoose').connection.readyState === 1; } catch (e) { return false; }
}

function isDeletedMobile(m) {
  const c = cleanMobile(m);
  if (c.length < 10) return false;
  const { deletedMobiles } = require('../store');
  return Array.isArray(deletedMobiles) && deletedMobiles.includes(c);
}

function findUserByMobile(m) {
  const c = cleanMobile(m);
  if (c.length < 10) return null;
  const { registeredUsers } = require('../store');
  return registeredUsers.find(u => cleanMobile(u.mobile) === c) || null;
}

// Copies one user's balances from memory to MongoDB (fire-and-forget).
function mirrorUserToMongo(u) {
  if (!u || !mongoReady()) return;
  const mob = cleanMobile(u.mobile);
  if (mob.length < 10) return;
  try {
    const User = require('../models/User');
    const dep = round2(u.deposit_balance);
    const win = round2(u.winning_balance);
    User.updateMany(
      { mobile: { $regex: new RegExp(mob + '$') } },
      { $set: {
        deposit_balance: dep, winning_balance: win, wallet_balance: round2(dep + win),
        bonus_balance: round2(u.bonus_balance), commission_balance: round2(u.commission_balance)
      } }
    ).catch(e => console.error('[Mongo mirror]', e.message));
  } catch (e) {}
}

// 'pending' / 'APPROVED' / 'refunded' -> 'Pending' / 'Approved' / 'Refunded'
function statusOf(s) {
  const x = String(s || 'pending').toLowerCase();
  return x.charAt(0).toUpperCase() + x.slice(1);
}
const isPending = s => statusOf(s) === 'Pending';

// Best timestamp (ms) for a deposit / withdrawal record from memory or MongoDB.
function timeOf(r) {
  if (!r) return 0;
  const id = String(r._id || r.id || '');
  const m = id.match(/^(?:wth|dep)_(\d{12,})/);
  if (m) return parseInt(m[1], 10);
  for (const k of ['timestamp', 'created_at', 'createdAt', 'date', 'rawDate']) {
    const v = r[k];
    if (typeof v === 'number' && v > 1e11) return v;
    if (v) { const t = new Date(v).getTime(); if (Number.isFinite(t) && t > 1e11) return t; }
  }
  if (isObjectId(id)) return parseInt(id.slice(0, 8), 16) * 1000;
  return 0;
}

const refsOf = r => [r.utr, r.utr_number, r.client_txn_id, r.order_id]
  .filter(v => v && v !== 'N/A').map(String);

// Adds MongoDB deposit requests that are missing from memory. Never changes the status of a
// deposit memory already has (memory is where approve/reject happen), and skips deleted users.
function mergeDbDeposits(memoryDeposits, dbDeps, formatNew) {
  let added = 0;
  for (const d of dbDeps || []) {
    const dbId = String(d._id || '');
    const mob = cleanMobile(d.mobile || d.user_id);
    if (mob && isDeletedMobile(mob)) continue;
    const refs = [d.utr_number, d.utr].filter(v => v && v !== 'N/A').map(String);
    const amt = parseFloat(d.amount) || 0;
    const t = timeOf(d);
    const twin = memoryDeposits.find(m => {
      if (String(m._id) === dbId || String(m.mongo_id || '') === dbId) return true;
      const mRefs = refsOf(m);
      if (refs.length && mRefs.some(x => refs.includes(x))) return true;
      return mob && cleanMobile(m.mobile) === mob && Math.abs((parseFloat(m.amount) || 0) - amt) < 0.01 && Math.abs(timeOf(m) - t) < 5 * 60 * 1000;
    });
    if (twin) {
      if (!twin.mongo_id && String(twin._id) !== dbId) twin.mongo_id = dbId;
      continue;
    }
    memoryDeposits.unshift(formatNew(d, mob));
    added++;
  }
  return added;
}

// The 10-digit mobile behind a MongoDB withdrawal request (older requests only stored the
// app's internal user id, so look it up instead of reading digits out of that id).
function withdrawalMobile(w, mongoUsers) {
  const direct = cleanMobile(w.mobile || w.phone);
  if (direct.length === 10) return direct;
  const uid = String(w.user_id || '');
  const { registeredUsers } = require('../store');
  const mem = registeredUsers.find(u => String(u.id || '') === uid || String(u._id || '') === uid);
  if (mem) return cleanMobile(mem.mobile);
  const db = (mongoUsers || []).find(u => String(u._id) === uid || String(u.id || '') === uid);
  if (db) return cleanMobile(db.mobile);
  const digits = uid.replace(/[^0-9]/g, '');
  return digits.length === 10 ? digits : '';
}

function isWithdrawalTwin(m, w, mob) {
  const dbId = String(w._id || '');
  if (String(m._id) === dbId || String(m.id) === dbId || String(m.mongo_id || '') === dbId) return true;
  if (Math.abs((parseFloat(m.amount) || 0) - (parseFloat(w.amount) || 0)) >= 0.01) return false;
  if (Math.abs(timeOf(m) - timeOf(w)) > 3 * 60 * 1000) return false;
  const mMob = cleanMobile(m.mobile || m.phone);
  if (mob && mMob && mMob === mob) return true;
  const names = [m.name, m.account_name, m.user].filter(Boolean).map(s => String(s).toLowerCase());
  const wName = String(w.username || w.name || '').toLowerCase();
  return !!wName && names.includes(wName);
}

// Adds MongoDB withdrawal requests that are missing from memory (never duplicates one memory
// already has, never changes its status, skips deleted users).
function mergeDbWithdrawals(memoryWithdrawals, dbWths, mongoUsers, formatNew) {
  let added = 0;
  for (const w of dbWths || []) {
    const mob = withdrawalMobile(w, mongoUsers);
    if (mob && isDeletedMobile(mob)) continue;
    const twin = memoryWithdrawals.find(m => isWithdrawalTwin(m, w, mob));
    if (twin) {
      const dbId = String(w._id);
      if (!twin.mongo_id && String(twin._id) !== dbId && String(twin.id) !== dbId) twin.mongo_id = dbId;
      continue;
    }
    memoryWithdrawals.unshift(formatNew(w, mob));
    added++;
  }
  return added;
}

// Removes withdrawal copies that an older version of getWithdrawals added from MongoDB next to
// the original request (same amount, same person, within 3 minutes). Keeps the original and
// carries over anything final from the copy, so a request can never be refunded twice.
function collapseDuplicateWithdrawals(memoryWithdrawals) {
  let removed = 0;
  for (let i = memoryWithdrawals.length - 1; i >= 0; i--) {
    const copy = memoryWithdrawals[i];
    const cid = String(copy._id || copy.id || '');
    if (!isObjectId(cid)) continue;
    const original = memoryWithdrawals.find(m => m !== copy && !isObjectId(String(m._id || m.id || '')) &&
      isWithdrawalTwin(m, { _id: cid, amount: copy.amount, createdAt: copy.created_at || copy.createdAt || copy.timestamp, username: copy.user || copy.name, mobile: copy.mobile }, cleanMobile(copy.mobile)));
    if (!original) continue;
    if (copy.refundProcessed) original.refundProcessed = true;
    if (!isPending(copy.status) && isPending(original.status)) original.status = statusOf(copy.status);
    if (!original.mongo_id) original.mongo_id = cid;
    memoryWithdrawals.splice(i, 1);
    removed++;
  }
  return removed;
}

// Fields never sent back to a caller who hasn't proven they own the account.
function publicUser(u) {
  if (!u) return u;
  const { password, password_hash, account_number, account_holder_name, ifsc_code, upi_id, bank_name, ...rest } = u;
  return rest;
}

module.exports = {
  cleanMobile, round2, isObjectId, mongoReady, isDeletedMobile, findUserByMobile, mirrorUserToMongo,
  statusOf, isPending, timeOf, mergeDbDeposits, mergeDbWithdrawals, withdrawalMobile, collapseDuplicateWithdrawals, publicUser
};
