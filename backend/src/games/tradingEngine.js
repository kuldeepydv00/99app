// Shared round engine for Number, Card and Colour Trading, and Dragon Tiger.
//
// How a round works (disclosed to players on every trading screen):
//   - betting is open for the first part of the round, then locked;
//   - at the end of the round, the option with the LOWEST total amount bet wins;
//   - ties between equally-low options are broken with crypto.randomInt;
//   - an option nobody bet on has 0 staked, so it counts as lowest.
// Dragon Tiger (also disclosed on its screen): about 1 round in 20 is a Tie, picked at random
// whatever the bets; otherwise the lower total of Dragon and Tiger wins. The two cards are then
// drawn to match the result (higher card wins, A low, K high; same rank = Tie).
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
  },
  dragontiger: {
    key: 'dragontiger', label: 'Dragon Tiger', prefix: 'DT',
    options: ['DRAGON', 'TIGER', 'TIE'],
    roundMs: MINUTE, betMs: 50 * 1000, maxOptionsPerBet: 3
  }
};

// ---------- Dragon Tiger ----------
const DT = 'dragontiger';
const DT_SIDES = ['DRAGON', 'TIGER'];
const DT_DEFAULT_TIE_CHANCE = 0.05; // 1 in 20

function tieChanceOf(cfg) {
  const c = Number(cfg && cfg.tieChance);
  return Number.isFinite(c) && c >= 0 && c <= 0.5 ? c : DT_DEFAULT_TIE_CHANCE;
}
const oneIn = p => (p > 0 ? Math.round(1 / p) : 0);
const pctText = p => `${Math.round(p * 10000) / 100}%`;

// Payout multiplier for one option (Dragon Tiger's Tie has its own).
function payoutFor(game, option) {
  const cfg = state.config[game];
  if (game === DT && option === 'TIE') return Number(cfg.tiePayout) || 15;
  return cfg.payout;
}

// Picks the result of a Dragon Tiger round from its totals.
function pickDtResult(totals, cfg) {
  const p = tieChanceOf(cfg);
  const d = (totals && totals.DRAGON) || 0;
  const t = (totals && totals.TIGER) || 0;
  if (p > 0 && crypto.randomInt(1000000) < Math.round(p * 1000000)) {
    return { result: 'TIE', winningTotal: (totals && totals.TIE) || 0, tiedCount: 1, randomTie: true };
  }
  if (d === t) return { result: DT_SIDES[crypto.randomInt(2)], winningTotal: d, tiedCount: 2, randomTie: false };
  return d < t
    ? { result: 'DRAGON', winningTotal: d, tiedCount: 1, randomTie: false }
    : { result: 'TIGER', winningTotal: t, tiedCount: 1, randomTie: false };
}

// Draws the two cards that show a result: the winner gets the higher rank (A low, K high),
// a Tie gets the same rank. Ranks and suits come from crypto.randomInt.
function drawDtCards(result) {
  const suit = () => SUITS[crypto.randomInt(SUITS.length)];
  let d, t;
  if (result === 'TIE') {
    d = t = crypto.randomInt(RANKS.length);
  } else {
    const a = crypto.randomInt(RANKS.length);
    let b = crypto.randomInt(RANKS.length - 1);
    if (b >= a) b += 1;
    const hi = Math.max(a, b), lo = Math.min(a, b);
    if (result === 'DRAGON') { d = hi; t = lo; } else { d = lo; t = hi; }
  }
  return { dragon: RANKS[d] + suit(), tiger: RANKS[t] + suit() };
}

const RULE_LINE = 'Lowest total bet wins this round. Ties are picked at random.';
function ruleLineFor(game) {
  if (game !== DT) return RULE_LINE;
  const p = tieChanceOf(state.config[game]);
  return p > 0
    ? `Lower total bet of Dragon and Tiger wins. About 1 in ${oneIn(p)} rounds is a Tie.`
    : 'Lower total bet of Dragon and Tiger wins.';
}
function rulesText(game) {
  const def = GAMES[game];
  const cfg = state.config[game];
  if (game === DT) {
    const p = tieChanceOf(cfg);
    return [
      'A new round starts every minute: betting is open for the first 50 seconds, then locked; the result is out at 60 seconds.',
      p > 0
        ? `About 1 in ${oneIn(p)} rounds (${pctText(p)}) is a Tie. A Tie is picked at random, no matter how much is bet on anything.`
        : 'Tie is switched off right now, so every round is won by Dragon or Tiger.',
      'In every other round, Dragon or Tiger wins: whichever side has the LOWER total amount bet on it this round. If both totals are equal, one is picked at random.',
      'A side nobody bet on has ₹0 on it, so it counts as the lower one.',
      'The two cards are drawn to show the result: the higher card wins (A is low, K is high). The same rank on both is a Tie.',
      `Dragon and Tiger pay ${cfg.payout}x the amount bet. Tie pays ${Number(cfg.tiePayout) || 15}x. On a Tie, Dragon and Tiger bets lose.`,
      'Winnings go into your Winning balance.',
      `Bets: ₹${Number(cfg.minBet).toLocaleString('en-IN')} minimum, ₹${Number(cfg.maxBet).toLocaleString('en-IN')} maximum per option per round.`
    ];
  }
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

function publicRound(r, raw = false) {
  if (!r) return null;
  const cancelled = r.status === 'cancelled';
  return { roundId: r.roundId, start: r.start, lock: r.lock, end: r.end, status: cancelled && !raw ? 'locked' : r.status, cancelled };
}

function receipt(r) {
  const out = {
    roundId: r.roundId, result: r.result, winningTotal: r.winningTotal,
    tiedCount: r.tiedCount, totalOptions: GAMES[r.game].options.length, settledAt: r.settledAt, end: r.end
  };
  if (r.game === DT) {
    out.cards = r.cards || null;
    out.randomTie = !!r.randomTie;
    // After the round is over, both side totals are shown so players can check the rule.
    out.sides = { DRAGON: (r.totals && r.totals.DRAGON) || 0, TIGER: (r.totals && r.totals.TIGER) || 0 };
  }
  return out;
}

// ---------- settlement ----------
const settling = new Set();
function settleRound(game, r) {
  const key = game + ':' + r.roundId;
  if (r.status === 'settled' || r.status === 'cancelled' || settling.has(key)) return;
  settling.add(key);
  try {
    const def = GAMES[game];
    let result, min, tiedCount, dtPick = null;
    if (game === DT) {
      dtPick = pickDtResult(r.totals, state.config[game]);
      result = dtPick.result; min = dtPick.winningTotal; tiedCount = dtPick.tiedCount;
    } else {
      min = Infinity;
      for (const opt of def.options) {
        const v = r.totals[opt] || 0;
        if (v < min) min = v;
      }
      const tied = def.options.filter(o => (r.totals[o] || 0) === min);
      result = tied[crypto.randomInt(tied.length)];
      tiedCount = tied.length;
    }

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
    r.tiedCount = tiedCount;
    if (dtPick) {
      r.randomTie = dtPick.randomTie;
      r.tieChance = tieChanceOf(state.config[game]);
      r.cards = drawDtCards(result);
    }
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
const KEEP_MS = { number: 30 * 24 * HOUR, card: 30 * 24 * HOUR, colour: 3 * 24 * HOUR, dragontiger: 3 * 24 * HOUR };
const BET_KEEP_MS = 40 * 24 * HOUR;
let lastPrune = 0;

function prune(t) {
  for (const game of Object.keys(GAMES)) {
    const rounds = state.rounds[game];
    for (const id of Object.keys(rounds)) {
      const r = rounds[id];
      if ((r.status === 'settled' || r.status === 'cancelled') && r.end < t - KEEP_MS[game]) delete rounds[id];
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
        if (r.status !== 'settled' && r.status !== 'cancelled' && r.end <= t) settleRound(game, r);
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
  if (round.status === 'cancelled') throw new GameError(400, 'This round was cancelled by the admin. Please bet in the next round.');
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
  const created = [];
  for (const [opt, amt] of Object.entries(merged)) {
    const mult = payoutFor(game, opt);
    const bet = {
      id: `${def.prefix.toLowerCase()}_${t}_${crypto.randomInt(1e9)}`,
      game, roundId: round.roundId, mobile: clean, user: u.name || `User ${clean.slice(-4)}`,
      option: opt, amount: amt, multiplier: mult,
      potential_win: wallet.round2(amt * mult),
      ...wallet.shareOf(split, total, amt),
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
  const out = {
    game, label: def.label, serverTime: t,
    enabled: cfg.enabled !== false, payout: cfg.payout, minBet: cfg.minBet, maxBet: cfg.maxBet,
    options: def.options,
    round: live ? publicRound(live) : { roundId: roundIdFor(game, b.start), start: b.start, lock: b.lock, end: b.end, status: t >= b.lock ? 'locked' : 'open' },
    lastResults: settledRounds(game).slice(0, game === DT ? 60 : (def.roundMs < HOUR ? 30 : 20)).map(receipt),
    ruleLine: ruleLineFor(game),
    rules: rulesText(game)
  };
  if (game === DT) {
    const p = tieChanceOf(cfg);
    out.payouts = { DRAGON: cfg.payout, TIGER: cfg.payout, TIE: payoutFor(game, 'TIE') };
    out.tiePayout = payoutFor(game, 'TIE');
    out.tieChance = p;
    out.tieOneIn = oneIn(p);
  }
  return out;
}

function getLobby() {
  const out = { serverTime: now(), trading: {} };
  for (const game of Object.keys(GAMES)) {
    const s = getPublicState(game);
    out.trading[game] = {
      label: s.label, enabled: s.enabled, payout: s.payout, round: s.round,
      lastResult: s.lastResults[0] || null
    };
    if (game === DT) { out.trading[game].tiePayout = s.tiePayout; out.trading[game].tieOneIn = s.tieOneIn; }
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
  // Dragon Tiger: only Dragon and Tiger compete on totals (Tie is random).
  const contest = game === DT ? DT_SIDES : def.options;
  let min = Infinity;
  contest.forEach(o => { if (totals[o] < min) min = totals[o]; });
  const lowest = contest.filter(o => totals[o] === min);

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
  let tie = null;
  if (game === DT) {
    const p = tieChanceOf(cfg);
    let tiePay = 0;
    if (live) {
      for (const bet of state.bets) {
        if (bet.game === game && bet.roundId === live.roundId && bet.status === 'pending' && bet.option === 'TIE') tiePay += bet.amount * bet.multiplier;
      }
    }
    tie = { chance: p, oneIn: oneIn(p), payout: payoutFor(game, 'TIE'), wouldPay: wallet.round2(tiePay) };
  }

  const dayStart = istDayStart(t);
  const today = Object.values(state.rounds[game]).filter(r => r.start >= dayStart && r.status !== 'cancelled');
  const staked = today.reduce((s, r) => s + (r.totalStaked || 0), 0);
  const paid = today.filter(r => r.status === 'settled').reduce((s, r) => s + (r.totalPaid || 0), 0);

  return {
    game, label: def.label, serverTime: t, config: cfg, options: def.options,
    round: live ? {
      ...publicRound(live, true), totalStaked: live.totalStaked, betCount: live.betCount,
      players: Object.keys(live.players || {}).length
    } : { ...b, roundId: roundIdFor(game, b.start), status: 'open', totalStaked: 0, betCount: 0, players: 0 },
    totals,
    projection: {
      lowestOptions: lowest.length > 12 ? lowest.slice(0, 12) : lowest,
      lowestCount: lowest.length, lowestTotal: min === Infinity ? 0 : min,
      payoutMin: pays.length ? wallet.round2(Math.min(...pays)) : 0,
      payoutMax: pays.length ? wallet.round2(Math.max(...pays)) : 0,
      tie
    },
    today: {
      staked: wallet.round2(staked), paid: wallet.round2(paid), net: wallet.round2(staked - paid),
      rounds: today.filter(r => r.status === 'settled').length,
      roundsWithBets: today.filter(r => r.betCount > 0).length
    }
  };
}

function getAdminRounds(game, { limit = 50, offset = 0, withBetsOnly = false, date = null } = {}) {
  let list = Object.values(state.rounds[game])
    .filter(r => r.status === 'settled' || r.status === 'cancelled')
    .sort((a, b) => b.end - a.end);
  if (withBetsOnly) list = list.filter(r => r.betCount > 0);
  if (date) list = list.filter(r => istDateOf(r.start) === date);
  return {
    total: list.length,
    rounds: list.slice(offset, offset + limit).map(r => ({
      roundId: r.roundId, status: r.status, cancelReason: r.cancelReason || null,
      refundedBets: r.refundedBets || 0, refundedAmount: r.refundedAmount || 0,
      start: r.start, end: r.end, totalStaked: r.totalStaked, betCount: r.betCount,
      players: Object.keys(r.players || {}).length, result: r.result, winningTotal: r.winningTotal,
      tiedCount: r.tiedCount, winners: r.winners, totalPaid: r.totalPaid,
      net: r.status === 'cancelled' ? 0 : wallet.round2((r.totalStaked || 0) - (r.totalPaid || 0)),
      ...(game === DT ? { cards: r.cards || null, randomTie: !!r.randomTie, totals: r.totals || {} } : {})
    }))
  };
}

function getAdminBets(game, { roundId, mobile, status, date, limit = 500 } = {}) {
  const clean = mobile ? wallet.cleanMobile(mobile) : null;
  return state.bets
    .filter(b => b.game === game && (!roundId || b.roundId === roundId) && (!clean || b.mobile === clean)
      && (!status || b.status === status) && (!date || istDateOf(b.created_at) === date))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit);
}

// 'YYYY-MM-DD' in IST for a timestamp (ms) or ISO string
function istDateOf(t) {
  const ms = typeof t === 'number' ? t : new Date(t).getTime();
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms + IST_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// Cancels a round that has not been settled yet and gives every stake back.
// Used when something went wrong with a round; a settled round can't be cancelled.
function cancelRound(game, roundId, reason) {
  const def = GAMES[game];
  if (!def) throw new GameError(404, 'Unknown game');
  const r = state.rounds[game][roundId];
  if (!r) throw new GameError(404, 'Round not found');
  if (r.status === 'settled') throw new GameError(400, 'This round is already settled, so it can’t be cancelled.');
  if (r.status === 'cancelled') throw new GameError(400, 'This round is already cancelled.');
  if (settling.has(game + ':' + roundId)) throw new GameError(409, 'This round is being settled right now. Try again in a moment.');
  const why = String(reason || '').trim().slice(0, 120) || 'Cancelled by admin';

  let count = 0, amount = 0;
  for (const b of state.bets) {
    if (b.game !== game || b.roundId !== roundId || b.status !== 'pending') continue;
    const u = wallet.findUser(b.mobile);
    wallet.refundStake(u, b, `Refund: ${def.label} round ${roundId} cancelled`);
    b.status = 'refunded';
    b.refunded_at = new Date(now()).toISOString();
    b.refund_reason = why;
    count += 1;
    amount += b.amount;
  }
  r.status = 'cancelled';
  r.cancelledAt = now();
  r.cancelReason = why;
  r.refundedBets = count;
  r.refundedAmount = wallet.round2(amount);
  wallet.persistWallets();
  saveNow();
  console.log(`[${def.label}] ${roundId} cancelled by admin (${why}): refunded ₹${r.refundedAmount} on ${count} bets`);
  return { roundId, game, refundedBets: count, refundedAmount: r.refundedAmount, reason: why };
}

// Day-by-day totals (IST) for the last `days` days, newest first.
function getDailyReport(game, days = 14) {
  const out = {};
  const t = now();
  for (let i = 0; i < days; i++) {
    const key = istDateOf(t - i * 24 * HOUR);
    out[key] = { date: key, bets: 0, players: new Set(), staked: 0, paid: 0, refunded: 0, rounds: 0, cancelledRounds: 0 };
  }
  for (const b of state.bets) {
    if (b.game !== game) continue;
    const row = out[istDateOf(b.created_at)];
    if (!row) continue;
    if (b.status === 'refunded') { row.refunded += b.amount; continue; }
    row.bets += 1; row.players.add(b.mobile); row.staked += b.amount; row.paid += b.win_amount || 0;
  }
  for (const r of Object.values(state.rounds[game])) {
    const row = out[istDateOf(r.start)];
    if (!row) continue;
    if (r.status === 'settled') row.rounds += 1;
    if (r.status === 'cancelled') row.cancelledRounds += 1;
  }
  return Object.values(out).map(r => ({
    date: r.date, bets: r.bets, players: r.players.size,
    staked: wallet.round2(r.staked), paid: wallet.round2(r.paid), net: wallet.round2(r.staked - r.paid),
    refunded: wallet.round2(r.refunded), rounds: r.rounds, cancelledRounds: r.cancelledRounds
  }));
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
  if (game === DT) {
    const tiePayout = num(body.tiePayout), tieChance = num(body.tieChance);
    if (tiePayout !== undefined) {
      if (!Number.isFinite(tiePayout) || tiePayout < 2 || tiePayout > 100) throw new GameError(400, 'Tie payout must be between 2x and 100x');
      cfg.tiePayout = tiePayout;
    }
    if (tieChance !== undefined) {
      if (!Number.isFinite(tieChance) || tieChance < 0 || tieChance > 0.5) throw new GameError(400, 'Tie chance must be between 0% and 50%');
      cfg.tieChance = Math.round(tieChance * 10000) / 10000;
    }
  }
  if (cfg.maxBet < cfg.minBet) throw new GameError(400, 'Maximum bet must be at least the minimum bet');
  saveNow();
  return cfg;
}

module.exports = {
  GAMES, CARD_OPTIONS, RULE_LINE, GameError, DT, payoutFor, pickDtResult, drawDtCards, tieChanceOf,
  setClock, now, roundBounds, roundIdFor, ensureRound, tick, startTicker, stopTicker, settleRound,
  placeBets, getPublicState, getLobby, getMyBets,
  getAdminOverview, getAdminRounds, getAdminBets, updateConfig, cancelRound, getDailyReport, istDateOf
};
