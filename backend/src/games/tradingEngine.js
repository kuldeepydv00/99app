// Shared round engine for Number, Card and Colour Trading.
//
// How a round works (disclosed to players on every trading screen):
//   - betting is open for the first part of the round, then locked;
//   - at the end of the round, the option with the LOWEST total amount bet wins;
//   - ties between equally-low options are broken with crypto.randomInt;
//   - an option nobody bet on has 0 staked, so it counts as lowest.
const crypto = require('crypto');
const { state, saveNow, markDirty } = require('./gamesStore');
const wallet = require('./wallet');

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

const SUITS = ['S', 'H', 'D', 'C'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const CARD_OPTIONS = [];
SUITS.forEach(s => RANKS.forEach(r => CARD_OPTIONS.push(r + s)));

const GAMES = {
  number: {
    key: 'number', label: 'Number Trading', prefix: 'NUM',
    options: Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0')),
    roundMs: HOUR, betMs: 50 * MINUTE, maxOptionsPerBet: 100
  },
  card: {
    key: 'card', label: 'Card Trading', prefix: 'CRD',
    options: CARD_OPTIONS,
    roundMs: HOUR, betMs: 50 * MINUTE, maxOptionsPerBet: 52
  },
  colour: {
    key: 'colour', label: 'Colour Trading', prefix: 'COL',
    options: ['RED', 'BLUE', 'GREEN'],
    roundMs: MINUTE, betMs: 50 * 1000, maxOptionsPerBet: 3
  }
};

const RULE_LINE = 'Lowest total bet wins this round. Ties are picked at random.';
function rulesText(game) {
  const def = GAMES[game];
  const cfg = state.config[game];
  const win = def.roundMs >= HOUR ? 'every hour: betting is open from :00 to :50, then locked; the result is out at :60.'
    : 'every minute: betting is open for the first 50 seconds, then locked; the result is out at 60 seconds.';
  return [
    `A new round starts ${win}`,
    'When the round ends, the option with the lowest total amount bet on it wins.',
    def.options.length > 3
      ? `An option nobody picked has ₹0 on it, so it counts as the lowest. With ${def.options.length} options, some option usually has ₹0, so most rounds end on an option nobody picked and no one wins.`
      : 'An option nobody picked has ₹0 on it, so it counts as the lowest.',
    'If several options tie for the lowest total, one of them is picked at random.',
    `Winning bets pay ${cfg.payout}x the amount bet, into your Winning balance.`,
    `Bets: ₹${Number(cfg.minBet).toLocaleString('en-IN')} minimum, ₹${Number(cfg.maxBet).toLocaleString('en-IN')} maximum per option per round.`
  ];
}

// Test hook: lets the self-test drive the engine with a fake clock.
let nowFn = () => Date.now();
function setClock(fn) { nowFn = fn || (() => Date.now()); }
function now() { return nowFn(); }

const pad = n => String(n).padStart(2, '0');

function roundBounds(game, t) {
  const def = GAMES[game];
  const startShifted = Math.floor((t + IST_OFFSET_MS) / def.roundMs) * def.roundMs;
  const start = startShifted - IST_OFFSET_MS;
  return { start, lock: start + def.betMs, end: start + def.roundMs };
}

function roundIdFor(game, start) {
  const def = GAMES[game];
  const d = new Date(start + IST_OFFSET_MS); // UTC getters now read IST fields
  const ymd = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
  const hh = pad(d.getUTCHours());
  return def.roundMs >= HOUR ? `${def.prefix}-${ymd}-${hh}` : `${def.prefix}-${ymd}-${hh}${pad(d.getUTCMinutes())}`;
}

function ensureRound(game, start) {
  const rounds = state.rounds[game];
  const id = roundIdFor(game, start);
  if (!rounds[id]) {
    const def = GAMES[game];
    rounds[id] = {
      roundId: id, game, start, lock: start + def.betMs, end: start + def.roundMs,
      totals: {}, betCount: 0, players: {}, totalStaked: 0,
      status: 'open', result: null, winningTotal: null, tiedCount: null,
      winners: 0, totalPaid: 0, settledAt: null
    };
    markDirty();
  }
  return rounds[id];
}

function publicRound(r) {
  if (!r) return null;
  return { roundId: r.roundId, start: r.start, lock: r.lock, end: r.end, status: r.status };
}

function receipt(r) {
  return {
    roundId: r.roundId, result: r.result, winningTotal: r.winningTotal,
    tiedCount: r.tiedCount, totalOptions: GAMES[r.game].options.length, settledAt: r.settledAt, end: r.end
  };
}

// ---------- settlement ----------
const settling = new Set();
function settleRound(game, r) {
  const key = game + ':' + r.roundId;
  if (r.status === 'settled' || settling.has(key)) return;
  settling.add(key);
  try {
    const def = GAMES[game];
    let min = Infinity;
    for (const opt of def.options) {
      const v = r.totals[opt] || 0;
      if (v < min) min = v;
    }
    const tied = def.options.filter(o => (r.totals[o] || 0) === min);
    const result = tied[crypto.randomInt(tied.length)];

    let winners = 0, totalPaid = 0, anyCredit = false;
    for (const b of state.bets) {
      if (b.game !== game || b.roundId !== r.roundId || b.status !== 'pending') continue;
      if (b.option === result) {
        const win = wallet.round2(b.amount * b.multiplier);
        b.status = 'won';
        b.win_amount = win;
        winners += 1;
        totalPaid += win;
        const u = wallet.findUser(b.mobile);
        if (u) {
          wallet.creditWin(u, win, `Won ₹${win} on ${def.label} (${r.roundId}, ${result})`, r.roundId);
          anyCredit = true;
        }
      } else {
        b.status = 'lost';
        b.win_amount = 0;
      }
      b.result = result;
      b.settled_at = new Date(now()).toISOString();
    }

    r.result = result;
    r.winningTotal = wallet.round2(min);
    r.tiedCount = tied.length;
    r.winners = winners;
    r.totalPaid = wallet.round2(totalPaid);
    r.status = 'settled';
    r.settledAt = now();

    if (anyCredit) wallet.persistWallets();
    saveNow();
    if (r.betCount > 0) {
      console.log(`[${def.label}] ${r.roundId} settled: result ${result} (₹${r.winningTotal}, ${r.tiedCount} tied), staked ₹${r.totalStaked}, paid ₹${r.totalPaid} to ${winners}`);
    }
  } finally {
    settling.delete(key);
  }
}

// ---------- ticker ----------
const KEEP_MS = { number: 30 * 24 * HOUR, card: 30 * 24 * HOUR, colour: 3 * 24 * HOUR };
const BET_KEEP_MS = 40 * 24 * HOUR;
let lastPrune = 0;

function prune(t) {
  for (const game of Object.keys(GAMES)) {
    const rounds = state.rounds[game];
    for (const id of Object.keys(rounds)) {
      const r = rounds[id];
      if (r.status === 'settled' && r.end < t - KEEP_MS[game]) delete rounds[id];
    }
  }
  const cutoff = t - BET_KEEP_MS;
  const before = state.bets.length;
  state.bets = state.bets.filter(b => b.status === 'pending' || new Date(b.created_at).getTime() >= cutoff);
  if (state.bets.length !== before) markDirty();
}

function tick() {
  const t = now();
  for (const game of Object.keys(GAMES)) {
    try {
      if (state.config[game] && state.config[game].enabled !== false) {
        const b = roundBounds(game, t);
        const live = ensureRound(game, b.start);
        if (t >= live.lock && live.status === 'open') { live.status = 'locked'; markDirty(); }
      }
      // Settle every round that has ended (also catches up after a restart)
      const rounds = state.rounds[game];
      for (const id of Object.keys(rounds)) {
        const r = rounds[id];
        if (r.status !== 'settled' && r.end <= t) settleRound(game, r);
      }
    } catch (err) {
      console.error(`[Trading ${game}] tick error:`, err.message);
    }
  }
  if (t - lastPrune > MINUTE) { lastPrune = t; prune(t); }
}

let tickHandle = null;
function startTicker() {
  if (tickHandle) return;
  tick();
  tickHandle = setInterval(tick, 1000);
  if (tickHandle.unref) tickHandle.unref();
}
function stopTicker() { if (tickHandle) { clearInterval(tickHandle); tickHandle = null; } }

// ---------- player actions ----------
class GameError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function normalizeOption(game, raw) {
  if (raw === undefined || raw === null) return null;
  if (game === 'number') {
    const s = String(raw).trim();
    if (!/^\d{1,3}$/.test(s)) return null;
    let n = parseInt(s, 10);
    if (n === 100) n = 0; // older Android builds send 100 for "00"
    if (n < 0 || n > 99) return null;
    return pad(n);
  }
  const s = String(raw).trim().toUpperCase();
  return GAMES[game].options.includes(s) ? s : null;
}

function placeBets(game, mobile, items) {
  const def = GAMES[game];
  if (!def) throw new GameError(404, 'Unknown game');
  const cfg = state.config[game];
  if (!cfg || cfg.enabled === false) throw new GameError(400, `${def.label} is closed right now.`);

  const t = now();
  const b = roundBounds(game, t);
  if (t >= b.lock) throw new GameError(400, 'Betting is closed for this round. The next round opens when this result is out.');

  if (!Array.isArray(items) || items.length === 0) throw new GameError(400, 'No bets provided');
  if (items.length > def.maxOptionsPerBet) throw new GameError(400, 'Too many bets in one slip');

  // Merge duplicates and validate
  const merged = {};
  for (const it of items) {
    const opt = normalizeOption(game, it.option !== undefined ? it.option : it.number);
    const amt = Number(it.amount !== undefined ? it.amount : it.bet_amount);
    if (!opt) throw new GameError(400, 'Invalid option in bet slip');
    if (!Number.isFinite(amt) || amt <= 0 || Math.floor(amt) !== amt) throw new GameError(400, 'Bet amounts must be whole rupees');
    merged[opt] = (merged[opt] || 0) + amt;
  }

  const clean = wallet.cleanMobile(mobile);
  const round = ensureRound(game, b.start);
  const already = {};
  for (const bet of state.bets) {
    if (bet.game === game && bet.roundId === round.roundId && bet.mobile === clean && bet.status !== 'refunded') {
      already[bet.option] = (already[bet.option] || 0) + bet.amount;
    }
  }
  let total = 0;
  for (const [opt, amt] of Object.entries(merged)) {
    if (amt < cfg.minBet) throw new GameError(400, `Minimum bet is ₹${cfg.minBet} per option`);
    if ((already[opt] || 0) + amt > cfg.maxBet) throw new GameError(400, `Maximum is ₹${cfg.maxBet} per option per round (${opt})`);
    total += amt;
  }

  const u = wallet.findUser(clean);
  const blockMsg = wallet.checkCanBet(u, clean);
  if (blockMsg) throw new GameError(403, blockMsg);

  const split = wallet.deductStake(u, total);
  if (!split) {
    throw new GameError(400, `Insufficient balance. Need ₹${total.toFixed(2)}.`);
  }

  const createdAt = new Date(t).toISOString();
  const bonusRatio = total > 0 ? split.bonus / total : 0;
  const created = [];
  for (const [opt, amt] of Object.entries(merged)) {
    const bet = {
      id: `${def.prefix.toLowerCase()}_${t}_${crypto.randomInt(1e9)}`,
      game, roundId: round.roundId, mobile: clean, user: u.name || `User ${clean.slice(-4)}`,
      option: opt, amount: amt, multiplier: cfg.payout,
      potential_win: wallet.round2(amt * cfg.payout),
      bonus_used: wallet.round2(amt * bonusRatio),
      status: 'pending', win_amount: 0, result: null,
      created_at: createdAt
    };
    state.bets.push(bet);
    created.push(bet);
    round.totals[opt] = wallet.round2((round.totals[opt] || 0) + amt);
    round.betCount += 1;
  }
  round.players[clean] = true;
  round.totalStaked = wallet.round2(round.totalStaked + total);

  wallet.persistWallets();
  saveNow();
  return { round: publicRound(round), bets: created, total, balances: wallet.balances(u) };
}

// ---------- read models ----------
function settledRounds(game) {
  return Object.values(state.rounds[game]).filter(r => r.status === 'settled').sort((a, b) => b.end - a.end);
}

function getPublicState(game) {
  const def = GAMES[game];
  const cfg = state.config[game];
  const t = now();
  const b = roundBounds(game, t);
  const live = state.rounds[game][roundIdFor(game, b.start)];
  return {
    game, label: def.label, serverTime: t,
    enabled: cfg.enabled !== false, payout: cfg.payout, minBet: cfg.minBet, maxBet: cfg.maxBet,
    options: def.options,
    round: live ? publicRound(live) : { roundId: roundIdFor(game, b.start), start: b.start, lock: b.lock, end: b.end, status: t >= b.lock ? 'locked' : 'open' },
    lastResults: settledRounds(game).slice(0, game === 'colour' ? 30 : 20).map(receipt),
    ruleLine: RULE_LINE,
    rules: rulesText(game)
  };
}

function getLobby() {
  const out = { serverTime: now(), trading: {} };
  for (const game of Object.keys(GAMES)) {
    const s = getPublicState(game);
    out.trading[game] = {
      label: s.label, enabled: s.enabled, payout: s.payout, round: s.round,
      lastResult: s.lastResults[0] || null
    };
  }
  return out;
}

function getMyBets(game, mobile, limit = 100) {
  const clean = wallet.cleanMobile(mobile);
  return state.bets
    .filter(b => b.mobile === clean && (!game || game === 'all' ? GAMES[b.game] : b.game === game))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit);
}

// ---------- admin ----------
function istDayStart(t) {
  const shifted = t + IST_OFFSET_MS;
  return Math.floor(shifted / (24 * HOUR)) * 24 * HOUR - IST_OFFSET_MS;
}

function getAdminOverview(game) {
  const def = GAMES[game];
  const cfg = state.config[game];
  const t = now();
  const b = roundBounds(game, t);
  const live = state.rounds[game][roundIdFor(game, b.start)] || null;

  const totals = {};
  def.options.forEach(o => { totals[o] = live ? (live.totals[o] || 0) : 0; });
  let min = Infinity;
  def.options.forEach(o => { if (totals[o] < min) min = totals[o]; });
  const lowest = def.options.filter(o => totals[o] === min);

  // What the round would pay if it ended now, for each currently-lowest option
  const payByOption = {};
  if (live) {
    for (const bet of state.bets) {
      if (bet.game === game && bet.roundId === live.roundId && bet.status === 'pending' && lowest.includes(bet.option)) {
        payByOption[bet.option] = (payByOption[bet.option] || 0) + bet.amount * bet.multiplier;
      }
    }
  }
  const pays = lowest.map(o => payByOption[o] || 0);

  const dayStart = istDayStart(t);
  const today = Object.values(state.rounds[game]).filter(r => r.start >= dayStart);
  const staked = today.reduce((s, r) => s + (r.totalStaked || 0), 0);
  const paid = today.filter(r => r.status === 'settled').reduce((s, r) => s + (r.totalPaid || 0), 0);

  return {
    game, label: def.label, serverTime: t, config: cfg, options: def.options,
    round: live ? {
      ...publicRound(live), totalStaked: live.totalStaked, betCount: live.betCount,
      players: Object.keys(live.players || {}).length
    } : { ...b, roundId: roundIdFor(game, b.start), status: 'open', totalStaked: 0, betCount: 0, players: 0 },
    totals,
    projection: {
      lowestOptions: lowest.length > 12 ? lowest.slice(0, 12) : lowest,
      lowestCount: lowest.length, lowestTotal: min === Infinity ? 0 : min,
      payoutMin: pays.length ? wallet.round2(Math.min(...pays)) : 0,
      payoutMax: pays.length ? wallet.round2(Math.max(...pays)) : 0
    },
    today: {
      staked: wallet.round2(staked), paid: wallet.round2(paid), net: wallet.round2(staked - paid),
      rounds: today.filter(r => r.status === 'settled').length,
      roundsWithBets: today.filter(r => r.betCount > 0).length
    }
  };
}

function getAdminRounds(game, { limit = 50, offset = 0, withBetsOnly = false } = {}) {
  let list = settledRounds(game);
  if (withBetsOnly) list = list.filter(r => r.betCount > 0);
  return {
    total: list.length,
    rounds: list.slice(offset, offset + limit).map(r => ({
      roundId: r.roundId, start: r.start, end: r.end, totalStaked: r.totalStaked, betCount: r.betCount,
      players: Object.keys(r.players || {}).length, result: r.result, winningTotal: r.winningTotal,
      tiedCount: r.tiedCount, winners: r.winners, totalPaid: r.totalPaid,
      net: wallet.round2((r.totalStaked || 0) - (r.totalPaid || 0))
    }))
  };
}

function getAdminBets(game, { roundId, mobile, limit = 500 } = {}) {
  const clean = mobile ? wallet.cleanMobile(mobile) : null;
  return state.bets
    .filter(b => b.game === game && (!roundId || b.roundId === roundId) && (!clean || b.mobile === clean))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit);
}

function updateConfig(game, body) {
  const cfg = state.config[game];
  if (!cfg) throw new GameError(404, 'Unknown game');
  if (body.enabled !== undefined) cfg.enabled = !!body.enabled;
  const num = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));
  const payout = num(body.payout), minBet = num(body.minBet), maxBet = num(body.maxBet);
  if (payout !== undefined) {
    if (!Number.isFinite(payout) || payout <= 0 || payout > 1000) throw new GameError(400, 'Payout must be between 0 and 1000');
    cfg.payout = payout;
  }
  if (minBet !== undefined) {
    if (!Number.isInteger(minBet) || minBet < 1) throw new GameError(400, 'Minimum bet must be a whole number of at least ₹1');
    cfg.minBet = minBet;
  }
  if (maxBet !== undefined) {
    if (!Number.isInteger(maxBet) || maxBet < 1) throw new GameError(400, 'Maximum bet must be a whole number');
    cfg.maxBet = maxBet;
  }
  if (cfg.maxBet < cfg.minBet) throw new GameError(400, 'Maximum bet must be at least the minimum bet');
  saveNow();
  return cfg;
}

module.exports = {
  GAMES, CARD_OPTIONS, RULE_LINE, GameError,
  setClock, now, roundBounds, roundIdFor, ensureRound, tick, startTicker, stopTicker, settleRound,
  placeBets, getPublicState, getLobby, getMyBets,
  getAdminOverview, getAdminRounds, getAdminBets, updateConfig
};
