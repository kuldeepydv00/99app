// 60-day bet history.
//
// Every bet (Matka markets and all new games: 99x Matka, Number / Card / Colour Trading,
// Dragon Tiger, Toss, 99x Jet, Dice, Mines) is deleted once its day is more than 60 days old.
// Before a day is deleted, its bets are added up into one line per game: number of bets,
// players, total staked, paid out, wins (no names or mobiles). The admin reports add these
// lines back, so profit for old days and "all time" totals keep working.
//
// Rules:
// - A bet's day is its business date (Matka cycle date / 99x market date / IST day it was placed).
// - Bets dated before (today - 60 days) are deleted. Pending bets are never deleted; they are
//   added to the totals and deleted once they are settled.
// - Each day is added to the totals once. If an old copy of a bet turns up again later (for
//   example from MongoDB), it is deleted without being counted twice.
// - Wallet history, deposits and withdrawals are NOT touched (owner's choice, 9 Oct 2026).
// - MongoDB's bet collection already deletes bets after 60 days (TTL index on Bet.created_at).
const { getISTDateStr } = require('./dateCycle');

const KEEP_DAYS = 60;
const DAY_MS = 86400000;
const RUN_EVERY_MS = 6 * 3600 * 1000;
const FIRST_RUN_MS = 60 * 1000;
const MATKA = 'matka';
const NEW_GAMES = ['matka99', 'number', 'card', 'colour', 'dragontiger', 'toss', 'jet', 'dice', 'mines'];

const round2 = n => parseFloat((Number(n) || 0).toFixed(2));
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const ms = v => { const t = new Date(v).getTime(); return Number.isFinite(t) ? t : 0; };
const istDate = t => getISTDateStr(new Date(t));
function addDays(date, n) {
  return new Date(new Date(date + 'T12:00:00Z').getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

// Bets dated before this IST date are deleted.
function cutoffDate(now = Date.now()) { return istDate(now - KEEP_DAYS * DAY_MS); }

// True when a bet placed at this time is past the 60 days (used when copying bets from MongoDB).
function isExpired(when, now = Date.now()) {
  const t = ms(when);
  return !!t && istDate(t) < cutoffDate(now);
}

// ---------- reading bets ----------
function matkaDay(b) {
  const k = b.date_key || b.createdDateKey;
  if (isDate(k)) return k;
  const t = ms(b.created_at || b.createdAt || b.date);
  return t ? istDate(t) : null;
}
function matkaStatus(b) {
  const s = String(b.status || 'pending').toLowerCase();
  if (s === 'pending' || s === 'won' || s === 'lost') return s;
  return 'refunded'; // refunded / cancelled / rejected
}
function gameDay(b) {
  if (b.game === 'matka99' && isDate(b.dateKey)) return b.dateKey;
  const t = ms(b.created_at);
  return t ? istDate(t) : null;
}
function gameStatus(b) {
  const s = String(b.status || 'pending').toLowerCase();
  if (s === 'pending' || s === 'won' || s === 'lost') return s;
  return 'refunded';
}

// ---------- totals ----------
function emptyLine() { return { bets: 0, players: 0, staked: 0, paid: 0, wins: 0, refunded: 0, expected: 0 }; }

function archive() {
  const { state } = require('../games/gamesStore');
  if (!state.archive) state.archive = { days: {}, closedThrough: null, pendingLeft: [], lastRun: null, runs: [] };
  const a = state.archive;
  if (!a.days) a.days = {};
  if (!Array.isArray(a.pendingLeft)) a.pendingLeft = [];
  if (!Array.isArray(a.runs)) a.runs = [];
  return a;
}

function addToLine(days, playerSets, day, game, { amount, paid, status, expected, mobile }) {
  if (!days[day]) days[day] = {};
  const line = days[day][game] || (days[day][game] = emptyLine());
  if (status === 'refunded') { line.refunded = round2(line.refunded + amount); return; }
  line.bets += 1;
  line.staked = round2(line.staked + amount);
  if (status === 'won') { line.wins += 1; line.paid = round2(line.paid + paid); }
  line.expected = round2(line.expected + (expected || 0));
  const key = `${day}|${game}`;
  if (!playerSets.has(key)) playerSets.set(key, new Set());
  if (mobile) playerSets.get(key).add(mobile);
}

// ---------- the clean-up ----------
let running = false;

function run({ now = Date.now(), by = 'auto' } = {}) {
  if (running) return null;
  running = true;
  try {
    const store = require('../store');
    const gs = require('../games/gamesStore');
    const A = archive();
    const cutoff = cutoffDate(now);
    const closed = A.closedThrough;
    const pendingLeft = new Set(A.pendingLeft);
    const playerSets = new Map();
    const res = { matka: 0, games: 0, pendingKept: 0, duplicates: 0, days: new Set() };

    // Decides what to do with one old bet: 'keep' (pending), 'count' (add to totals, delete) or 'drop' (already counted).
    const decide = (id, day, status) => {
      if (status === 'pending') { pendingLeft.add(id); res.pendingKept += 1; return 'keep'; }
      if (closed && day <= closed && !pendingLeft.has(id)) { res.duplicates += 1; return 'drop'; }
      pendingLeft.delete(id);
      return 'count';
    };

    // Matka markets (dataStore.json)
    const keepMatka = [];
    for (const b of store.memoryBets) {
      const day = matkaDay(b);
      if (!day || day >= cutoff) { keepMatka.push(b); continue; }
      const status = matkaStatus(b);
      const what = decide(`m:${b._id || b.id || ''}`, day, status);
      if (what === 'keep') { keepMatka.push(b); continue; }
      if (what === 'count') {
        addToLine(A.days, playerSets, day, MATKA, {
          amount: parseFloat(b.bet_amount !== undefined ? b.bet_amount : b.amount) || 0,
          paid: parseFloat(b.win_amount) || 0, status,
          mobile: String(b.mobile || b.phone || '').replace(/[^0-9]/g, '').slice(-10)
        });
        res.days.add(day);
      }
      res.matka += 1;
    }
    if (res.matka) {
      store.memoryBets.length = 0;
      for (const b of keepMatka) store.memoryBets.push(b);
    }

    // New games (gamesStore.json)
    const keepGames = [];
    for (const b of gs.state.bets) {
      const day = NEW_GAMES.includes(b.game) ? gameDay(b) : null;
      if (!day || day >= cutoff) { keepGames.push(b); continue; }
      const status = gameStatus(b);
      const what = decide(`g:${b.id}`, day, status);
      if (what === 'keep') { keepGames.push(b); continue; }
      if (what === 'count') {
        addToLine(A.days, playerSets, day, b.game, {
          amount: Number(b.amount) || 0, paid: Number(b.win_amount) || 0, status,
          expected: (Number(b.amount) || 0) * (Number(b.edge) || 0), mobile: b.mobile
        });
        res.days.add(day);
      }
      res.games += 1;
    }
    if (res.games) gs.state.bets = keepGames;

    for (const [key, set] of playerSets) {
      const [day, game] = key.split('|');
      A.days[day][game].players += set.size;
    }

    const lastClosed = addDays(cutoff, -1);
    if (!closed || lastClosed > closed) A.closedThrough = lastClosed;
    A.pendingLeft = [...pendingLeft].slice(-5000);
    const summary = {
      at: new Date(now).toISOString(), by, cutoff, keepDays: KEEP_DAYS,
      deletedMatka: res.matka, deletedGames: res.games, pendingKept: res.pendingKept,
      duplicatesDropped: res.duplicates, daysAdded: [...res.days].sort()
    };
    A.lastRun = summary;
    A.runs = [summary, ...A.runs].slice(0, 30);

    if (res.matka) store.saveDiskStore();
    gs.saveNow();

    // MongoDB keeps its own copy of Matka bets with a 60-day expiry; remove the expired ones now too.
    try {
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState === 1) {
        const Bet = require('../models/Bet');
        const before = new Date(new Date(cutoff + 'T00:00:00+05:30').getTime());
        Bet.deleteMany({ created_at: { $lt: before }, status: { $ne: 'pending' } })
          .catch(e => console.error('[Bet cleanup] MongoDB:', e.message));
      }
    } catch (e) {}

    if (res.matka || res.games) {
      console.log(`[Bet cleanup] Deleted ${res.matka} Matka and ${res.games} game bets dated before ${cutoff}; daily totals kept.`);
    }
    return summary;
  } finally {
    running = false;
  }
}

let timer = null;
function start() {
  if (timer) return;
  const first = setTimeout(() => { try { run(); } catch (e) { console.error('[Bet cleanup]', e.message); } }, FIRST_RUN_MS);
  if (first.unref) first.unref();
  timer = setInterval(() => { try { run(); } catch (e) { console.error('[Bet cleanup]', e.message); } }, RUN_EVERY_MS);
  if (timer.unref) timer.unref();
}
function stop() { if (timer) { clearInterval(timer); timer = null; } }

// ---------- totals for the reports ----------
function addLine(to, line) {
  to.bets += line.bets || 0;
  to.players += line.players || 0;
  to.staked = round2(to.staked + (line.staked || 0));
  to.paid = round2(to.paid + (line.paid || 0));
  to.wins += line.wins || 0;
  to.refunded = round2(to.refunded + (line.refunded || 0));
  to.expected = round2(to.expected + (line.expected || 0));
  return to;
}

// Totals kept for deleted days. games: list of game keys ('matka' for the Matka markets).
// from / to: IST dates (inclusive) for `range`; `allTime` covers every archived day.
function totals(games, from, to) {
  const A = archive();
  const out = { range: emptyLine(), allTime: emptyLine(), byGame: {}, days: {} };
  for (const g of games) out.byGame[g] = { range: emptyLine(), allTime: emptyLine() };
  for (const [day, lines] of Object.entries(A.days)) {
    const inRange = (!from || day >= from) && (!to || day <= to);
    for (const g of games) {
      const line = lines[g];
      if (!line) continue;
      addLine(out.allTime, line); addLine(out.byGame[g].allTime, line);
      if (inRange) {
        addLine(out.range, line); addLine(out.byGame[g].range, line);
        if (!out.days[day]) out.days[day] = {};
        out.days[day][g] = { ...line };
      }
    }
  }
  return out;
}

function status(now = Date.now()) {
  const A = archive();
  const days = Object.keys(A.days).sort();
  return {
    keepDays: KEEP_DAYS,
    cutoff: cutoffDate(now),
    closedThrough: A.closedThrough,
    archivedDays: days.length,
    firstArchivedDay: days[0] || null,
    lastArchivedDay: days[days.length - 1] || null,
    pendingKept: A.pendingLeft.length,
    lastRun: A.lastRun,
    runs: A.runs.slice(0, 10),
    runEveryHours: RUN_EVERY_MS / 3600000
  };
}

module.exports = { KEEP_DAYS, MATKA, NEW_GAMES, cutoffDate, isExpired, run, start, stop, totals, status, addDays };
