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

function persistWallets() {
  try { saveDiskStore(); } catch (e) { console.error('[Games Wallet] saveDiskStore failed:', e.message); }
}

module.exports = { round2, cleanMobile, findUser, checkCanBet, balances, deductStake, creditWin, persistWallets };
