// 99x Matka: the same 8 markets and timings as Matka, renamed, with its own bets,
// results and chart, and a fixed 99x payout on every winning Jodi.
const crypto = require('crypto');
const { state, saveNow, MATKA99_MARKETS } = require('./gamesStore');
const wallet = require('./wallet');
const { gameSchedulesStore } = require('../store');
const { getMarketCycleDate, isGameInOpenWindow, getISTDateStr } = require('../utils/dateCycle');
const { GameError } = require('./tradingEngine');

const FIXED_PAYOUT = 99;
const pad = n => String(n).padStart(2, '0');

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

function getMarkets() {
  const today = getISTDateStr(new Date());
  return {
    serverTime: Date.now(),
    payout: FIXED_PAYOUT,
    minBet: state.matka99.config.minBet,
    maxBet: state.matka99.config.maxBet,
    markets: MATKA99_MARKETS.map(m => {
      const sched = scheduleFor(m.key) || {};
      const cycleDate = getMarketCycleDate(m.key, sched);
      const open = isOpen(m) && !isDeclared(m.key, cycleDate);
      return {
        key: m.key, name: m.name,
        open: sched.open || null, close: sched.close || null, resultTime: sched.result || null,
        enabled: state.matka99.enabled[m.key] !== false,
        isOpen: open, cycleDate,
        lastResult: state.matka99.declared[m.key] || null,
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
  const bonusRatio = total > 0 ? split.bonus / total : 0;
  const created = [];
  for (const [num, amt] of Object.entries(merged)) {
    const bet = {
      id: `m99_${t}_${crypto.randomInt(1e9)}`,
      game: 'matka99', market: m.key, marketName: m.name, dateKey,
      mobile: clean, user: u.name || `User ${clean.slice(-4)}`,
      option: num, amount: amt, multiplier: FIXED_PAYOUT,
      potential_win: wallet.round2(amt * FIXED_PAYOUT),
      bonus_used: wallet.round2(amt * bonusRatio),
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

function betsFor(key, dateKey) {
  return state.bets.filter(b => b.game === 'matka99' && b.market === key && b.dateKey === dateKey);
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

function declare(marketInput, dateKey, numberInput, { bypassWindowCheck = false } = {}) {
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
  state.matka99.declared[m.key] = { number: p.number, date: p.date, declaredAt: Date.now() };

  if (anyCredit) wallet.persistWallets();
  saveNow();
  console.log(`[99x Matka] ${m.name} ${p.date} declared ${p.number}: ${winners} winners, ₹${wallet.round2(totalPaid)} paid`);
  return { ...p, winners, totalPaid: wallet.round2(totalPaid), alreadyDeclared: true };
}

function getChart(limitDays = 60) {
  const dates = Object.keys(state.matka99.results).sort().reverse().slice(0, limitDays);
  return {
    markets: MATKA99_MARKETS.map(m => ({ key: m.key, name: m.name })),
    rows: dates.map(d => ({ date: d, results: state.matka99.results[d] }))
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
      const liveBets = mk.cycleDate !== date ? betsFor(mk.key, mk.cycleDate) : [];
      const sum = arr => wallet.round2(arr.reduce((s, b) => s + b.amount, 0));
      return {
        ...mk,
        date,
        staked: sum(bets), betCount: bets.length,
        players: new Set(bets.map(b => b.mobile)).size,
        paid: wallet.round2(bets.reduce((s, b) => s + (b.win_amount || 0), 0)),
        result: (state.matka99.results[date] || {})[mk.key] || null,
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

function getAdminBets({ market, date, mobile, number, limit = 500 } = {}) {
  const m = market ? resolveMarket(market) : null;
  const d = date ? getISTDateStr(date) : null;
  const clean = mobile ? wallet.cleanMobile(mobile) : null;
  const num = number !== undefined && number !== '' ? normalizeNumber(number) : null;
  return state.bets
    .filter(b => b.game === 'matka99'
      && (!m || b.market === m.key) && (!d || b.dateKey === d)
      && (!clean || b.mobile === clean) && (!num || b.option === num))
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
  getOverview, getMatrix, getAdminBets, setEnabled, updateLimits
};
