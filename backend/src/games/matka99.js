// 99x Matka: the same 8 markets and timings as Matka, renamed, with its own bets,
// results and chart, and a fixed 99x payout on every winning Jodi.
const crypto = require('crypto');
const { state, saveNow, MATKA99_MARKETS } = require('./gamesStore');
const wallet = require('./wallet');
const { gameSchedulesStore } = require('../store');
const { getMarketCycleDate, isGameInOpenWindow, getISTDateStr, parseMins } = require('../utils/dateCycle');
const { GameError } = require('./tradingEngine');

const FIXED_PAYOUT = 99;
const pad = n => String(n).padStart(2, '0');
const NUMBERS = Array.from({ length: 100 }, (_, i) => pad(i));
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// How 99x results work (shown to players on every 99x screen)
const RULE_LINE = 'Result at the market’s result time: the number with the lowest total bet wins. Ties are picked at random.';
function rulesText() {
  const cfg = state.matka99.config;
  return [
    'Each 99x market is declared automatically at its result time. 99x results are separate from the regular Matka results.',
    'The number (00–99) with the lowest total amount bet on it in that market wins.',
    'A number nobody picked has ₹0 on it, so it counts as the lowest. With 100 numbers, some number usually has ₹0, so most results land on a number nobody picked and no one wins.',
    'If several numbers tie for the lowest total, one of them is picked at random.',
    `Winning bets pay ${FIXED_PAYOUT}x the amount bet, into your Winning balance.`,
    `Bets: ₹${Number(cfg.minBet).toLocaleString('en-IN')} minimum, ₹${Number(cfg.maxBet).toLocaleString('en-IN')} maximum per number per market.`
  ];
}

function resolveMarket(input) {
  const s = String(input || '').trim().toLowerCase();
  if (!s) return null;
  return MATKA99_MARKETS.find(m => m.key.toLowerCase() === s || m.name.toLowerCase() === s) || null;
}

function scheduleFor(key) {
  return gameSchedulesStore[key]
    || (key === 'Desawar' ? gameSchedulesStore['Disawer'] : null)
    || (key === 'Shree Ganesh' ? gameSchedulesStore['Shri Ganesh'] : null)
    || null;
}

function isOpen(m) {
  if (state.matka99.enabled[m.key] === false) return false;
  return isGameInOpenWindow(m.key, scheduleFor(m.key));
}

function isDeclared(key, dateKey) {
  const day = state.matka99.results[dateKey];
  return !!(day && day[key] !== undefined && day[key] !== null);
}

// The moment (ms) a market's result is due for a market date: that IST date at the schedule's result time
// (close time if no result time is set). Null if the market has no schedule.
function resultAtFor(key, dateKey) {
  const sched = scheduleFor(key);
  if (!sched || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey))) return null;
  const mins = parseMins(sched.result || sched.close);
  const [y, m, d] = dateKey.split('-').map(Number);
  return Date.UTC(y, m - 1, d) - IST_OFFSET_MS + mins * 60000;
}

// Totals per number for a market date and the currently-lowest numbers.
function lowestFor(key, dateKey) {
  const totals = {};
  NUMBERS.forEach(n => { totals[n] = 0; });
  for (const b of state.bets) {
    if (b.game === 'matka99' && b.market === key && b.dateKey === dateKey && b.status === 'pending') {
      totals[b.option] = wallet.round2((totals[b.option] || 0) + b.amount);
    }
  }
  let min = Infinity;
  NUMBERS.forEach(n => { if (totals[n] < min) min = totals[n]; });
  const lowest = NUMBERS.filter(n => totals[n] === min);
  return { totals, min: wallet.round2(min), lowest };
}

function getMarkets() {
  const today = getISTDateStr(new Date());
  return {
    serverTime: Date.now(),
    payout: FIXED_PAYOUT,
    minBet: state.matka99.config.minBet,
    maxBet: state.matka99.config.maxBet,
    autoResults: true,
    ruleLine: RULE_LINE,
    rules: rulesText(),
    markets: MATKA99_MARKETS.map(m => {
      const sched = scheduleFor(m.key) || {};
      const cycleDate = getMarketCycleDate(m.key, sched);
      const open = isOpen(m) && !isDeclared(m.key, cycleDate);
      return {
        key: m.key, name: m.name,
        open: sched.open || null, close: sched.close || null, resultTime: sched.result || null,
        enabled: state.matka99.enabled[m.key] !== false,
        isOpen: open, cycleDate,
        resultAt: resultAtFor(m.key, cycleDate),
        lastResult: state.matka99.declared[m.key]
          ? { ...state.matka99.declared[m.key], ...((state.matka99.auto[state.matka99.declared[m.key].date] || {})[m.key] || {}) }
          : null,
        todayResult: (state.matka99.results[today] || {})[m.key] || null
      };
    })
  };
}

function normalizeNumber(raw) {
  const s = String(raw === undefined || raw === null ? '' : raw).trim();
  if (!/^\d{1,3}$/.test(s)) return null;
  let n = parseInt(s, 10);
  if (n === 100) n = 0; // older Android builds send 100 for "00"
  if (n < 0 || n > 99) return null;
  return pad(n);
}

function placeBets(mobile, marketInput, items) {
  const m = resolveMarket(marketInput);
  if (!m) throw new GameError(400, 'Unknown 99x market');
  if (state.matka99.enabled[m.key] === false) throw new GameError(400, `${m.name} is closed today.`);
  const sched = scheduleFor(m.key);
  if (!isGameInOpenWindow(m.key, sched)) {
    throw new GameError(400, `Betting is closed for ${m.name}.${sched ? ` Open ${sched.open} – ${sched.close}.` : ''}`);
  }
  const dateKey = getMarketCycleDate(m.key, sched);
  if (isDeclared(m.key, dateKey)) throw new GameError(400, `Result already declared for ${m.name}. Betting is closed.`);

  if (!Array.isArray(items) || items.length === 0) throw new GameError(400, 'No bets provided');
  if (items.length > 100) throw new GameError(400, 'Too many bets in one slip');

  const cfg = state.matka99.config;
  const merged = {};
  for (const it of items) {
    const num = normalizeNumber(it.number !== undefined ? it.number : it.option);
    const amt = Number(it.amount !== undefined ? it.amount : it.bet_amount);
    if (!num) throw new GameError(400, 'Numbers must be 00 to 99');
    if (!Number.isFinite(amt) || amt <= 0 || Math.floor(amt) !== amt) throw new GameError(400, 'Bet amounts must be whole rupees');
    merged[num] = (merged[num] || 0) + amt;
  }

  const clean = wallet.cleanMobile(mobile);
  const already = {};
  for (const b of state.bets) {
    if (b.game === 'matka99' && b.market === m.key && b.dateKey === dateKey && b.mobile === clean && b.status !== 'refunded') {
      already[b.option] = (already[b.option] || 0) + b.amount;
    }
  }
  let total = 0;
  for (const [num, amt] of Object.entries(merged)) {
    if (amt < cfg.minBet) throw new GameError(400, `Minimum bet is ₹${cfg.minBet} per number`);
    if ((already[num] || 0) + amt > cfg.maxBet) throw new GameError(400, `Maximum is ₹${cfg.maxBet} per number per market (${num})`);
    total += amt;
  }

  const u = wallet.findUser(clean);
  const blockMsg = wallet.checkCanBet(u, clean);
  if (blockMsg) throw new GameError(403, blockMsg);
  const split = wallet.deductStake(u, total);
  if (!split) throw new GameError(400, `Insufficient balance. Need ₹${total.toFixed(2)}.`);

  const t = Date.now();
  const createdAt = new Date(t).toISOString();
  const created = [];
  for (const [num, amt] of Object.entries(merged)) {
    const bet = {
      id: `m99_${t}_${crypto.randomInt(1e9)}`,
      game: 'matka99', market: m.key, marketName: m.name, dateKey,
      mobile: clean, user: u.name || `User ${clean.slice(-4)}`,
      option: num, amount: amt, multiplier: FIXED_PAYOUT,
      potential_win: wallet.round2(amt * FIXED_PAYOUT),
      ...wallet.shareOf(split, total, amt),
      status: 'pending', win_amount: 0, result: null,
      created_at: createdAt
    };
    state.bets.push(bet);
    created.push(bet);
  }
  wallet.persistWallets();
  saveNow();
  return { market: m.name, dateKey, bets: created, total, balances: wallet.balances(u) };
}

function betsFor(key, dateKey, { includeRefunded = false } = {}) {
  return state.bets.filter(b => b.game === 'matka99' && b.market === key && b.dateKey === dateKey
    && (includeRefunded || b.status !== 'refunded'));
}

// Most recent declared result left for a market (after an undo)
function latestDeclared(key) {
  const dates = Object.keys(state.matka99.results).sort().reverse();
  for (const d of dates) {
    const n = (state.matka99.results[d] || {})[key];
    if (n !== undefined && n !== null) return { number: n, date: d, declaredAt: null };
  }
  return null;
}

// Reverses a declared result: winners' payouts are taken back from their Winning balance
// (never below 0; any shortfall is reported), every bet goes back to pending, and the
// market can be declared again.
function undoDeclare(marketInput, dateInput) {
  const m = resolveMarket(marketInput);
  if (!m) throw new GameError(400, 'Unknown 99x market');
  const date = dateInput ? getISTDateStr(dateInput) : getISTDateStr(new Date());
  if (!isDeclared(m.key, date)) throw new GameError(400, `${m.name} has no declared result for ${date}.`);
  const number = state.matka99.results[date][m.key];

  let reversed = 0, clawedBack = 0, shortfall = 0, anyWallet = false;
  const shortfalls = [];
  for (const b of betsFor(m.key, date)) {
    if (b.status === 'won') {
      const u = wallet.findUser(b.mobile);
      const r = wallet.clawbackWin(u, b.win_amount || 0, `Result undone: ${m.name} ${date} (${number})`, b.id);
      clawedBack += r.taken; shortfall += r.shortfall; reversed += 1; anyWallet = true;
      if (r.shortfall > 0) shortfalls.push({ mobile: b.mobile, user: b.user, amount: r.shortfall });
    }
    if (b.status === 'won' || b.status === 'lost') {
      b.status = 'pending'; b.win_amount = 0; b.result = null; delete b.settled_at;
    }
  }
  delete state.matka99.results[date][m.key];
  if (Object.keys(state.matka99.results[date]).length === 0) delete state.matka99.results[date];
  if (state.matka99.auto[date]) delete state.matka99.auto[date][m.key];
  state.matka99.declared[m.key] = latestDeclared(m.key);
  if (anyWallet) wallet.persistWallets();
  saveNow();
  console.log(`[99x Matka] ${m.name} ${date} result ${number} undone: ${reversed} wins reversed, ₹${wallet.round2(clawedBack)} taken back, ₹${wallet.round2(shortfall)} short`);
  return {
    market: m.name, key: m.key, date, number, reversedWins: reversed,
    clawedBack: wallet.round2(clawedBack), shortfall: wallet.round2(shortfall), shortfalls
  };
}

// Cancels all pending bets on a market for a date and refunds the stakes.
// Only before a result is declared (undo the result first otherwise).
function refundMarket(marketInput, dateInput, reason) {
  const m = resolveMarket(marketInput);
  if (!m) throw new GameError(400, 'Unknown 99x market');
  const date = dateInput ? getISTDateStr(dateInput) : getISTDateStr(new Date());
  if (isDeclared(m.key, date)) throw new GameError(400, `${m.name} is already declared for ${date}. Undo the result first.`);
  const why = String(reason || '').trim().slice(0, 120) || 'Cancelled by admin';
  let count = 0, amount = 0;
  for (const b of betsFor(m.key, date)) {
    if (b.status !== 'pending') continue;
    wallet.refundStake(wallet.findUser(b.mobile), b, `Refund: ${m.name} ${date} cancelled`);
    b.status = 'refunded'; b.refunded_at = new Date().toISOString(); b.refund_reason = why;
    count += 1; amount += b.amount;
  }
  if (count > 0) wallet.persistWallets();
  saveNow();
  console.log(`[99x Matka] ${m.name} ${date} refunded by admin (${why}): ₹${wallet.round2(amount)} on ${count} bets`);
  return { market: m.name, key: m.key, date, refundedBets: count, refundedAmount: wallet.round2(amount), reason: why };
}

// Day-by-day totals (by market date) for the last `days` days, newest first.
function getDailyReport(days = 14) {
  const out = {};
  const base = Date.now();
  for (let i = 0; i < days; i++) {
    const key = getISTDateStr(new Date(base - i * 86400000));
    out[key] = { date: key, bets: 0, players: new Set(), staked: 0, paid: 0, refunded: 0, declared: 0 };
  }
  for (const b of state.bets) {
    if (b.game !== 'matka99') continue;
    const row = out[b.dateKey];
    if (!row) continue;
    if (b.status === 'refunded') { row.refunded += b.amount; continue; }
    row.bets += 1; row.players.add(b.mobile); row.staked += b.amount; row.paid += b.win_amount || 0;
  }
  for (const [d, res] of Object.entries(state.matka99.results)) if (out[d]) out[d].declared = Object.keys(res || {}).length;
  return Object.values(out).map(r => ({
    date: r.date, bets: r.bets, players: r.players.size, staked: wallet.round2(r.staked),
    paid: wallet.round2(r.paid), net: wallet.round2(r.staked - r.paid), refunded: wallet.round2(r.refunded), declared: r.declared
  }));
}

function previewDeclare(marketInput, dateKey, numberInput) {
  const m = resolveMarket(marketInput);
  if (!m) throw new GameError(400, 'Unknown 99x market');
  const num = normalizeNumber(numberInput);
  if (!num) throw new GameError(400, 'Result must be 00 to 99');
  const date = dateKey ? getISTDateStr(dateKey) : getISTDateStr(new Date());
  const bets = betsFor(m.key, date).filter(b => b.status === 'pending');
  const winning = bets.filter(b => b.option === num);
  return {
    market: m.name, key: m.key, date, number: num,
    betCount: bets.length,
    totalStaked: wallet.round2(bets.reduce((s, b) => s + b.amount, 0)),
    winningBets: winning.length,
    totalPayout: wallet.round2(winning.reduce((s, b) => s + b.amount * b.multiplier, 0)),
    alreadyDeclared: isDeclared(m.key, date),
    marketOpen: isOpen(m)
  };
}

function declare(marketInput, dateKey, numberInput, { bypassWindowCheck = false, auto = null } = {}) {
  const p = previewDeclare(marketInput, dateKey, numberInput);
  const m = resolveMarket(p.key);
  if (p.alreadyDeclared) throw new GameError(400, `${m.name} result is already declared for ${p.date}.`);
  if (!bypassWindowCheck && isGameInOpenWindow(m.key, scheduleFor(m.key)) && getMarketCycleDate(m.key, scheduleFor(m.key)) === p.date) {
    const sched = scheduleFor(m.key);
    throw new GameError(400, `${m.name} is still open for betting. Declare after ${sched ? sched.close : 'close'}.`);
  }

  let winners = 0, totalPaid = 0, anyCredit = false;
  for (const b of betsFor(m.key, p.date)) {
    if (b.status !== 'pending') continue;
    if (b.option === p.number) {
      const win = wallet.round2(b.amount * b.multiplier);
      b.status = 'won'; b.win_amount = win; winners += 1; totalPaid += win;
      const u = wallet.findUser(b.mobile);
      if (u) { wallet.creditWin(u, win, `Won ₹${win} on ${m.name} (${p.number})`, p.date); anyCredit = true; }
    } else {
      b.status = 'lost'; b.win_amount = 0;
    }
    b.result = p.number;
    b.settled_at = new Date().toISOString();
  }

  if (!state.matka99.results[p.date]) state.matka99.results[p.date] = {};
  state.matka99.results[p.date][m.key] = p.number;
  state.matka99.declared[m.key] = { number: p.number, date: p.date, declaredAt: Date.now(), auto: !!auto };
  if (auto) {
    if (!state.matka99.auto[p.date]) state.matka99.auto[p.date] = {};
    state.matka99.auto[p.date][m.key] = { winningTotal: auto.winningTotal, tiedCount: auto.tiedCount, at: Date.now() };
  }

  if (anyCredit) wallet.persistWallets();
  saveNow();
  console.log(`[99x Matka] ${m.name} ${p.date} ${auto ? 'auto-' : ''}declared ${p.number}${auto ? ` (₹${auto.winningTotal} on it, ${auto.tiedCount} tied)` : ''}: ${winners} winners, ₹${wallet.round2(totalPaid)} paid`);
  return { ...p, winners, totalPaid: wallet.round2(totalPaid), alreadyDeclared: true };
}

// ---------- automatic results ----------
// Declares every market whose result time has passed: the number with the lowest total
// pending bet wins, ties broken with crypto.randomInt. Also catches up after a restart
// (checks the last 3 market dates). Dates before automatic results started are only
// settled when they have pending bets, so the chart isn't back-filled with empty days.
function autoDeclareDue(now = Date.now()) {
  const today = getISTDateStr(new Date(now));
  if (!state.matka99.autoSince) { state.matka99.autoSince = today; saveNow(); }
  const done = [];
  for (const m of MATKA99_MARKETS) {
    const sched = scheduleFor(m.key);
    if (!sched) continue;
    for (let i = -3; i <= 0; i++) {
      const dateKey = getISTDateStr(new Date(now + i * 86400000));
      if (isDeclared(m.key, dateKey)) continue;
      const at = resultAtFor(m.key, dateKey);
      if (at === null || now < at) continue;
      // Never while betting for this date is still open (a mis-set schedule)
      if (isGameInOpenWindow(m.key, sched, new Date(now)) && getMarketCycleDate(m.key, sched, new Date(now)) === dateKey) continue;
      const pending = betsFor(m.key, dateKey).filter(b => b.status === 'pending').length;
      if (!pending && (dateKey < state.matka99.autoSince || state.matka99.enabled[m.key] === false)) continue;
      try {
        const low = lowestFor(m.key, dateKey);
        const number = low.lowest[crypto.randomInt(low.lowest.length)];
        const r = declare(m.key, dateKey, number, { bypassWindowCheck: true, auto: { winningTotal: low.min, tiedCount: low.lowest.length } });
        done.push({ key: m.key, date: dateKey, number, winners: r.winners, totalPaid: r.totalPaid });
      } catch (err) {
        console.error(`[99x Matka] auto result ${m.key} ${dateKey} failed:`, err.message);
      }
    }
  }
  return done;
}

let autoTimer = null;
function startAutoResults() {
  if (autoTimer) return;
  const run = () => { try { autoDeclareDue(); } catch (e) { console.error('[99x Matka] auto results:', e.message); } };
  run();
  autoTimer = setInterval(run, 15000);
  if (autoTimer.unref) autoTimer.unref();
}

function getChart(limitDays = 60) {
  const dates = Object.keys(state.matka99.results).sort().reverse().slice(0, limitDays);
  return {
    markets: MATKA99_MARKETS.map(m => ({ key: m.key, name: m.name })),
    rows: dates.map(d => ({ date: d, results: state.matka99.results[d], auto: state.matka99.auto[d] || {} }))
  };
}

function getMyBets(mobile, limit = 100) {
  const clean = wallet.cleanMobile(mobile);
  return state.bets
    .filter(b => b.game === 'matka99' && b.mobile === clean)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit);
}

// ---------- admin ----------
function getOverview(dateInput) {
  const date = dateInput ? getISTDateStr(dateInput) : getISTDateStr(new Date());
  const base = getMarkets();
  return {
    date, payout: FIXED_PAYOUT, config: state.matka99.config,
    markets: base.markets.map(mk => {
      const bets = betsFor(mk.key, date);
      const refundedAmt = wallet.round2(betsFor(mk.key, date, { includeRefunded: true })
        .filter(b => b.status === 'refunded').reduce((s, b) => s + b.amount, 0));
      const liveBets = mk.cycleDate !== date ? betsFor(mk.key, mk.cycleDate) : [];
      const declaredNum = (state.matka99.results[date] || {})[mk.key] || null;
      const resultAt = resultAtFor(mk.key, date);
      const low = declaredNum ? null : lowestFor(mk.key, date);
      const payNow = low ? low.lowest.map(n => bets.filter(b => b.status === 'pending' && b.option === n).reduce((s2, b) => s2 + b.amount * b.multiplier, 0)) : [];
      const sum = arr => wallet.round2(arr.reduce((s, b) => s + b.amount, 0));
      return {
        ...mk,
        date,
        staked: sum(bets), betCount: bets.length,
        players: new Set(bets.map(b => b.mobile)).size,
        paid: wallet.round2(bets.reduce((s, b) => s + (b.win_amount || 0), 0)),
        result: declaredNum,
        refunded: refundedAmt,
        pendingBets: bets.filter(b => b.status === 'pending').length,
        resultAt,
        autoRecord: (state.matka99.auto[date] || {})[mk.key] || null,
        projection: low ? {
          lowestCount: low.lowest.length, lowestTotal: low.min,
          lowest: low.lowest.length > 12 ? low.lowest.slice(0, 12) : low.lowest,
          payoutMin: payNow.length ? wallet.round2(Math.min(...payNow)) : 0,
          payoutMax: payNow.length ? wallet.round2(Math.max(...payNow)) : 0
        } : null,
        // Automatic result is late by more than 2 minutes (e.g. the server was off at result time)
        awaitingResult: !declaredNum && resultAt !== null && Date.now() > resultAt + 120000 && bets.some(b => b.status === 'pending'),
        liveCycleDate: mk.cycleDate, liveCycleStaked: mk.cycleDate !== date ? sum(liveBets) : sum(bets)
      };
    })
  };
}

function getMatrix(marketInput, dateInput) {
  const m = resolveMarket(marketInput);
  if (!m) throw new GameError(400, 'Unknown 99x market');
  const date = dateInput ? getISTDateStr(dateInput) : getISTDateStr(new Date());
  const totals = {};
  for (let i = 0; i < 100; i++) totals[pad(i)] = 0;
  const counts = { ...totals };
  for (const b of betsFor(m.key, date)) {
    totals[b.option] = wallet.round2(totals[b.option] + b.amount);
    counts[b.option] += 1;
  }
  return { market: m.name, key: m.key, date, totals, counts, result: (state.matka99.results[date] || {})[m.key] || null };
}

function getAdminBets({ market, date, mobile, number, status, limit = 500 } = {}) {
  const m = market ? resolveMarket(market) : null;
  const d = date ? getISTDateStr(date) : null;
  const clean = mobile ? wallet.cleanMobile(mobile) : null;
  const num = number !== undefined && number !== '' ? normalizeNumber(number) : null;
  return state.bets
    .filter(b => b.game === 'matka99'
      && (!m || b.market === m.key) && (!d || b.dateKey === d)
      && (!clean || b.mobile === clean) && (!num || b.option === num) && (!status || b.status === status))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit);
}

function setEnabled(marketInput, enabled) {
  const m = resolveMarket(marketInput);
  if (!m) throw new GameError(400, 'Unknown 99x market');
  state.matka99.enabled[m.key] = !!enabled;
  saveNow();
  return { key: m.key, name: m.name, enabled: !!enabled };
}

function updateLimits({ minBet, maxBet }) {
  const cfg = state.matka99.config;
  if (minBet !== undefined && minBet !== '') {
    const v = Number(minBet);
    if (!Number.isInteger(v) || v < 1) throw new GameError(400, 'Minimum bet must be a whole number of at least ₹1');
    cfg.minBet = v;
  }
  if (maxBet !== undefined && maxBet !== '') {
    const v = Number(maxBet);
    if (!Number.isInteger(v) || v < 1) throw new GameError(400, 'Maximum bet must be a whole number');
    cfg.maxBet = v;
  }
  if (cfg.maxBet < cfg.minBet) throw new GameError(400, 'Maximum bet must be at least the minimum bet');
  saveNow();
  return cfg;
}

module.exports = {
  FIXED_PAYOUT, resolveMarket, getMarkets, placeBets, previewDeclare, declare, getChart, getMyBets,
  getOverview, getMatrix, getAdminBets, setEnabled, updateLimits, undoDeclare, refundMarket, getDailyReport,
  scheduleFor, isDeclared, autoDeclareDue, startAutoResults, resultAtFor, lowestFor, RULE_LINE, rulesText
};
