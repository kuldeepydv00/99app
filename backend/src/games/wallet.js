// Wallet helpers for the new games. Same money rules as Matka bets:
// up to 10% of a stake from Bonus, the rest from Deposit, then Winning.
// Wins go to Winning balance (withdrawable). Memory is the source of truth;
// MongoDB is synced best-effort, exactly like the existing controllers do.
const { registeredUsers, blockedMobiles, deletedMobiles, saveDiskStore } = require('../store');

const round2 = n => parseFloat((Number(n) || 0).toFixed(2));
const cleanMobile = m => String(m || '').replace(/[^0-9]/g, '').slice(-10);

function findUser(mobile) {
  const clean = cleanMobile(mobile);
  if (clean.length < 10) return null;
  return registeredUsers.find(u => cleanMobile(u.mobile) === clean) || null;
}

function normalize(u) {
  if (u.bonus_balance === undefined) u.bonus_balance = 200.00;
  if (u.deposit_balance === undefined) u.deposit_balance = u.balance || 0.00;
  if (u.winning_balance === undefined) u.winning_balance = 0.00;
  if (u.commission_balance === undefined) u.commission_balance = 0.00;
}

// Returns an error message if this user may not bet, else null.
function checkCanBet(u, mobile) {
  const clean = cleanMobile(mobile);
  if (!u) return 'Account not found. Please log in again.';
  if (deletedMobiles && deletedMobiles.includes(clean)) return 'Account not found. Please log in again.';
  if (u.is_blocked || (blockedMobiles && blockedMobiles.includes(clean))) return 'This account is blocked. Contact support.';
  return null;
}

function balances(u) {
  return {
    balance: round2((u.deposit_balance || 0) + (u.winning_balance || 0)),
    deposit_balance: round2(u.deposit_balance),
    winning_balance: round2(u.winning_balance),
    bonus_balance: round2(u.bonus_balance)
  };
}

function syncToMongo(u) {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) return;
    const User = require('../models/User');
    User.updateOne(
      { mobile: { $regex: new RegExp(cleanMobile(u.mobile) + '$') } },
      { $set: {
        deposit_balance: u.deposit_balance,
        winning_balance: u.winning_balance,
        bonus_balance: u.bonus_balance,
        wallet_balance: u.balance
      } }
    ).catch(e => console.error('[Games Wallet Mongo Sync]', e.message));
  } catch (e) {}
}

// Takes `total` from the user's wallet. Returns the split taken, or null if
// the user can't cover it (nothing is deducted in that case). Synchronous on
// purpose: no await between the balance check and the deduction.
function deductStake(u, total) {
  normalize(u);
  total = round2(total);
  const bonus = round2(Math.min(total * 0.10, u.bonus_balance || 0));
  const remaining = round2(total - bonus);
  const main = round2((u.deposit_balance || 0) + (u.winning_balance || 0));
  if (main < remaining) return null;

  const fromDeposit = round2(Math.min(u.deposit_balance || 0, remaining));
  const fromWinning = round2(remaining - fromDeposit);

  u.bonus_balance = round2(u.bonus_balance - bonus);
  u.deposit_balance = round2(u.deposit_balance - fromDeposit);
  u.winning_balance = round2(u.winning_balance - fromWinning);
  u.balance = round2(u.deposit_balance + u.winning_balance);

  syncToMongo(u);
  return { bonus, deposit: fromDeposit, winning: fromWinning };
}

function creditWin(u, amount, description, dateKey) {
  if (!u || !(amount > 0)) return;
  normalize(u);
  u.winning_balance = round2(u.winning_balance + amount);
  u.balance = round2(u.deposit_balance + u.winning_balance);
  syncToMongo(u);
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const Transaction = require('../models/Transaction');
      Transaction.create({
        mobile: cleanMobile(u.mobile),
        type: 'WINNING',
        amount: round2(amount),
        status: 'success',
        description,
        date_key: dateKey,
        created_at: new Date()
      }).catch(e => console.error('[Games Win Txn]', e.message));
    }
  } catch (e) {}
}

function logTxn(u, type, amount, description, reference) {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) return;
    const Transaction = require('../models/Transaction');
    Transaction.create({
      mobile: cleanMobile(u.mobile), type, amount: round2(amount), status: 'success',
      description, reference_id: reference, created_at: new Date()
    }).catch(e => console.error('[Games Txn]', e.message));
  } catch (e) {}
}

// Per-bet share of a slip's funding split, so a refund can put money back where it came from.
function shareOf(split, total, amount) {
  const r = total > 0 ? amount / total : 0;
  return {
    bonus_used: round2(split.bonus * r),
    deposit_used: round2(split.deposit * r),
    winning_used: round2(split.winning * r)
  };
}

// Gives a refunded stake back: bonus to Bonus, deposit to Deposit, winning to Winning.
// Older bets that only recorded bonus_used get the rest back into Deposit.
function refundStake(u, bet, description) {
  if (!u || !bet) return 0;
  normalize(u);
  const bonus = round2(bet.bonus_used || 0);
  const hasSplit = bet.deposit_used !== undefined || bet.winning_used !== undefined;
  const dep = hasSplit ? round2(bet.deposit_used || 0) : round2((bet.amount || 0) - bonus);
  const win = hasSplit ? round2(bet.winning_used || 0) : 0;
  u.bonus_balance = round2(u.bonus_balance + bonus);
  u.deposit_balance = round2(u.deposit_balance + dep);
  u.winning_balance = round2(u.winning_balance + win);
  u.balance = round2(u.deposit_balance + u.winning_balance);
  syncToMongo(u);
  logTxn(u, 'REFUND', bet.amount, description, bet.id);
  return round2(bonus + dep + win);
}

// Takes back a win that was paid by mistake (result undone). Never pushes Winning below 0;
// whatever could not be taken back is returned as `shortfall` so the admin can see it.
function clawbackWin(u, amount, description, reference) {
  amount = round2(amount);
  if (!u || !(amount > 0)) return { taken: 0, shortfall: amount > 0 ? amount : 0 };
  normalize(u);
  const taken = round2(Math.min(amount, u.winning_balance || 0));
  u.winning_balance = round2(u.winning_balance - taken);
  u.balance = round2(u.deposit_balance + u.winning_balance);
  syncToMongo(u);
  if (taken > 0) logTxn(u, 'WIN_REVERSED', -taken, description, reference);
  return { taken, shortfall: round2(amount - taken) };
}

function persistWallets() {
  try { saveDiskStore(); } catch (e) { console.error('[Games Wallet] saveDiskStore failed:', e.message); }
}

module.exports = { round2, cleanMobile, findUser, checkCanBet, balances, deductStake, creditWin, refundStake, clawbackWin, shareOf, persistWallets };
