// Deleting a user removes everything that belongs to that account, everywhere:
// - the account itself (name, balances, bank details, referral code)
// - Matka bets, deposits, withdrawals, wallet history, notifications sent only to them
// - every new-game bet (99x Matka, trading games, Dragon Tiger, Toss, 99x Jet, Dice, Mines),
//   Dice / Mines seeds and any Mines game in play, and the live player entry
// - the same records in MongoDB
// Open bets in a running round come off that round's totals, as if never placed.
// Other users who joined with this person's referral code are unlinked (their own money is untouched).
// Every device that was logged in is logged out. Logging in again with OTP creates a brand-new
// account (with the normal sign-up bonus) and none of the old data.
const cleanMobile = m => String(m || '').replace(/[^0-9]/g, '').slice(-10);
const isObjectId = v => /^[0-9a-f]{24}$/i.test(String(v || ''));

// Removes matching items from an array in place; returns how many were removed.
function removeWhere(list, test) {
  if (!Array.isArray(list)) return 0;
  let n = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    if (test(list[i])) { list.splice(i, 1); n += 1; }
  }
  return n;
}

const mobileOf = r => cleanMobile(r && (r.mobile || r.phone || r.userPhone || r.user_mobile || r.userMobile || r.user));

// Finds the accounts for an admin's delete request: by id, or by the exact 10-digit mobile.
function findTargets(id) {
  const { registeredUsers } = require('../store');
  const raw = String(id || '').trim();
  const idIsMobile = /^\+?\d{10,13}$/.test(raw);
  const idClean = idIsMobile ? cleanMobile(raw) : '';
  const users = registeredUsers.filter(u => {
    const m = cleanMobile(u.mobile || u.phone);
    return String(u._id) === raw || String(u.id) === raw || (idClean && m === idClean);
  });
  const mobiles = new Set(users.map(u => cleanMobile(u.mobile || u.phone)).filter(m => m.length === 10));
  if (idClean.length === 10) mobiles.add(idClean);
  const ids = new Set();
  users.forEach(u => [u._id, u.id].forEach(v => { if (v) ids.add(String(v)); }));
  return { users, mobiles: [...mobiles], ids: [...ids] };
}

async function purgeUser(id, { by = 'admin' } = {}) {
  const store = require('../store');
  const { users, mobiles, ids } = findTargets(id);
  if (!users.length && !mobiles.length) return { found: false };

  const mob = new Set(mobiles);
  const idSet = new Set(ids);
  const mine = r => mob.has(mobileOf(r)) || (r && idSet.has(String(r.user_id || r.userId || '')));
  const removed = {};

  // 1. Matka store (dataStore.json)
  removed.accounts = removeWhere(store.registeredUsers, u => users.includes(u) || mob.has(cleanMobile(u.mobile || u.phone)));
  removed.matkaBets = removeWhere(store.memoryBets, mine);
  removed.deposits = removeWhere(store.memoryDeposits, mine);
  removed.withdrawals = removeWhere(store.memoryWithdrawals, mine);
  removed.walletHistory = removeWhere(store.memoryGameLedger, mine);
  removed.notifications = removeWhere(store.memoryNotifications, n => {
    const t = cleanMobile(n && (n.target || n.targetUser || n.mobile));
    return t.length === 10 && mob.has(t);
  });
  for (const m of mob) {
    if (store.notificationSeen) delete store.notificationSeen[m];
    if (store.userWalletStore && store.userWalletStore[m]) delete store.userWalletStore[m];
    if (store.userWalletStore && cleanMobile(store.userWalletStore.mobile) === m) {
      store.userWalletStore.balance = 0; store.userWalletStore.name = ''; store.userWalletStore.mobile = '';
    }
  }
  // People who joined with this person's referral code are unlinked
  let unlinked = 0;
  for (const u of store.registeredUsers) {
    if (u.referred_by && mob.has(cleanMobile(u.referred_by))) { u.referred_by = null; unlinked += 1; }
  }
  removed.referralLinks = unlinked;

  // The number stays on the deleted list until it logs in again with OTP; every old login token stops working
  for (const m of mob) {
    if (!store.deletedMobiles.includes(m)) store.deletedMobiles.push(m);
    store.endSessions(m);
  }

  // 2. New games (gamesStore.json)
  let gameBets = 0;
  try {
    const gs = require('../games/gamesStore');
    const engine = require('../games/tradingEngine');
    const jet = require('../games/jetEngine');
    const instant = require('../games/instantGames');
    const live = require('../games/livePlayers');
    for (const m of mob) {
      engine.forgetPlayer(m);
      jet.forgetPlayer(m);
      instant.forgetPlayer(m);
      live.leave(m);
    }
    const before = gs.state.bets.length;
    gs.state.bets = gs.state.bets.filter(b => !mob.has(cleanMobile(b.mobile)));
    gameBets = before - gs.state.bets.length;
    gs.saveNow();
  } catch (e) {
    console.error('[Delete user] games store:', e.message);
  }
  removed.gameBets = gameBets;

  store.saveDiskStore();

  // 3. MongoDB copy
  removed.mongo = false;
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const or = [];
      ids.filter(isObjectId).forEach(v => or.push({ _id: new mongoose.Types.ObjectId(v) }, { user_id: new mongoose.Types.ObjectId(v) }));
      ids.forEach(v => or.push({ user_id: v }));
      for (const m of mob) {
        const re = new RegExp(m + '$');
        or.push({ mobile: re }, { phone: re }, { user: re }, { user_id: re }, { userPhone: re });
      }
      if (or.length) {
        const db = mongoose.connection.db;
        for (const c of ['users', 'bets', 'transactions', 'depositrequests', 'withdrawalrequests']) {
          await db.collection(c).deleteMany({ $or: or }).catch(() => {});
        }
        const targets = [];
        for (const m of mob) targets.push(m, `+91${m}`);
        await db.collection('notifications').deleteMany({ target: { $in: targets } }).catch(() => {});
        const refRe = [...mob].map(m => ({ referred_by: new RegExp(m + '$') }));
        if (refRe.length) await db.collection('users').updateMany({ $or: refRe }, { $set: { referred_by: null } }).catch(() => {});
      }
      removed.mongo = true;
    }
  } catch (e) {
    console.error('[Delete user] MongoDB:', e.message);
  }

  console.log(`[Delete user] ${[...mob].join(', ')} deleted by ${by}:`, JSON.stringify(removed));
  return { found: true, mobiles: [...mob], removed };
}

module.exports = { purgeUser, findTargets };
