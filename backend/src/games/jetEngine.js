// 99x Jet: a fair crash game.
//
// How a round works (shown to players in the rules):
//   - betting is open for a few seconds; then the jet takes off at 1.00x and the multiplier climbs;
//   - it blasts at a point that was fixed before betting opened; bets not cashed out by then lose;
//   - blast point = (1 - edge) / (1 - r), floored to 2 decimals, at least 1.00x and at most 2000x,
//     where r comes from HMAC-SHA256(seed, salt);
//   - seeds come from a published SHA-256 hash chain, so every round can be checked afterwards.
//
// The blast point never depends on who bet or how much. Nothing in this file lets anyone choose
// a blast point or see one before the blast; admin settings only change limits and timing.
const crypto = require('crypto');
const { state, saveNow, markDirty } = require('./gamesStore');
const wallet = require('./wallet');
const { GameError } = require('./tradingEngine');

const GROWTH = 0.00006;              // multiplier = e^(GROWTH x ms flown): 2x at 11.6 s, 10x at 38.4 s
const MAX_POINT = 2000;
const MIN_CASHOUT = 1.01;
const PAUSE_MS = 3000;               // pause after a blast before the next round's betting opens
const CHAIN_LENGTH = parseInt(process.env.JET_CHAIN_LENGTH, 10) || 1000000;
const CHECKPOINT_EVERY = Math.min(10000, CHAIN_LENGTH);
const KEEP_HISTORY = 2000;           // ended rounds kept with their seeds (about 15 hours)
const MAX_STREAM_CLIENTS = 3000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const LABEL = '99x Jet';

const RULE_LINE = 'The jet blasts at a point fixed before betting opens. Cash out before it blasts.';

let nowFn = () => Date.now();
function setClock(fn) { nowFn = fn || (() => Date.now()); }
const now = () => nowFn();

const cfg = () => state.jet.config;
const sha256 = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const floor2 = n => Math.floor(n * 100 + 1e-9) / 100;
const money = n => Math.floor((Number(n) || 0) * 100 + 1e-6) / 100;
const pad = n => String(n).padStart(2, '0');
function istDateOf(t) {
  const ms = typeof t === 'number' ? t : new Date(t).getTime();
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms + IST_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
const inr = n => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// ---------- provably fair ----------
// The chain: h[length] is a random secret, h[i] = sha256(h[i+1]); h[0] is published.
// Round k uses h[k]; before it starts, players see sha256(h[k]) = h[k-1].
function newChain(startNo) {
  const length = CHAIN_LENGTH;
  const checkpoints = {};
  let h = crypto.randomBytes(32).toString('hex');
  checkpoints[length] = h;
  for (let i = length - 1; i >= 0; i--) {
    h = sha256(h);
    if (i % CHECKPOINT_EVERY === 0) checkpoints[i] = h;
  }
  return {
    id: h.slice(0, 12), length, terminatingHash: h, salt: crypto.randomBytes(16).toString('hex'),
    checkpoints, startNo, createdAt: new Date(now()).toISOString()
  };
}

function seedAt(chain, index) {
  const c = Math.min(chain.length, Math.ceil(index / CHECKPOINT_EVERY) * CHECKPOINT_EVERY);
  let h = chain.checkpoints[c];
  for (let j = c; j > index; j--) h = sha256(h);
  return h;
}

function blastPoint(seed, salt, edge) {
  const hmac = crypto.createHmac('sha256', String(seed)).update(String(salt)).digest('hex');
  const r = parseInt(hmac.slice(0, 13), 16) / 2 ** 52;
  const keep = (10000 - Math.round(edge * 10000)) / 100; // e.g. 96 for a 4% edge
  const raw = Math.floor(keep / (1 - r)) / 100;
  return Math.min(MAX_POINT, Math.max(1, raw));
}

function ensureChain() {
  const j = state.jet;
  if (j.chain && j.nextIndex <= j.chain.length) return j.chain;
  if (j.chain) {
    j.oldChains.unshift({ id: j.chain.id, terminatingHash: j.chain.terminatingHash, salt: j.chain.salt, startNo: j.chain.startNo, endNo: j.seq });
  }
  j.chain = newChain(j.seq + 1);
  j.nextIndex = 1;
  saveNow();
  console.log(`[${LABEL}] New seed chain ${j.chain.id}: terminating hash ${j.chain.terminatingHash}, salt ${j.chain.salt}`);
  return j.chain;
}

// ---------- multiplier ----------
const multAt = ms => (ms <= 0 ? 1 : floor2(Math.exp(GROWTH * ms)));
const msFor = point => (point <= 1 ? 0 : Math.ceil(Math.log(point) / GROWTH));

// ---------- live updates (server-sent events) ----------
const listeners = new Set();
function subscribe(fn) {
  if (listeners.size >= MAX_STREAM_CLIENTS) return null;
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(type, data) {
  const payload = { ...data, serverTime: now() };
  for (const fn of listeners) { try { fn(type, payload); } catch (e) { listeners.delete(fn); } }
}
let betsDirty = false;

// ---------- in-memory index of bets for the current and the next round ----------
let liveBets = [];   // bets of state.jet.round
let nextBets = [];   // bets queued for the next round
const nextId = () => `JET-${state.jet.seq + 1}`;

function rebuildIndex() {
  const r = state.jet.round;
  const nid = nextId();
  liveBets = r ? state.bets.filter(b => b.game === 'jet' && b.roundId === r.id) : [];
  nextBets = state.bets.filter(b => b.game === 'jet' && b.roundId === nid && b.status === 'pending');
}

// ---------- rounds ----------
function startRound(t) {
  const j = state.jet;
  const chain = ensureChain();
  const index = j.nextIndex;
  const seed = seedAt(chain, index);
  const no = j.seq + 1;
  const edge = cfg().edge;
  const r = {
    id: `JET-${no}`, no, chainId: chain.id, index, hash: sha256(seed), edge,
    point: blastPoint(seed, chain.salt, edge),
    phase: 'betting', createdAt: t, bettingEndsAt: t + Math.round(cfg().bettingSec * 1000),
    flyAt: null, blastAt: null, endedAt: null, seed: null,
    bets: 0, players: [], staked: 0, paid: 0, cashouts: 0
  };
  j.seq = no;
  j.nextIndex = index + 1;
  j.round = r;
  liveBets = nextBets.filter(b => b.roundId === r.id && b.status === 'pending');
  nextBets = [];
  for (const b of liveBets) addToRound(r, b);
  markDirty();
  emit('round', { round: publicRound(r) });
  return r;
}

function addToRound(r, b) {
  r.bets += 1;
  r.staked = wallet.round2(r.staked + b.amount);
  if (!r.players.includes(b.mobile)) r.players.push(b.mobile);
}
function removeFromRound(r, b) {
  r.bets = Math.max(0, r.bets - 1);
  r.staked = wallet.round2(r.staked - b.amount);
  if (!liveBets.some(x => x !== b && x.mobile === b.mobile && x.status !== 'refunded')) r.players = r.players.filter(m => m !== b.mobile);
}

// The multiplier at which a bet cashes out by itself: its auto target, or where it reaches the max win.
function autoTarget(b) {
  const maxWinAt = Math.max(MIN_CASHOUT, floor2(cfg().maxWin / b.amount));
  return Math.min(b.auto || Infinity, maxWinAt, MAX_POINT);
}

let walletsDirty = false;
function payOut(r, b, x, how, t) {
  const win = Math.min(money(b.amount * x), cfg().maxWin);
  b.status = 'won';
  b.cashout = x;
  b.multiplier = x;
  b.win_amount = win;
  b.cashed_by = how;
  b.option = `Cashed out ${x.toFixed(2)}x`;
  b.settled_at = new Date(t).toISOString();
  r.paid = wallet.round2(r.paid + win);
  r.cashouts += 1;
  const u = wallet.findUser(b.mobile);
  if (u) wallet.creditWin(u, win, `Won ${inr(win)} on ${LABEL} (${r.id}, cashed out at ${x.toFixed(2)}x)`, r.id);
  walletsDirty = true;
  betsDirty = true;
  emit('cashout', { roundId: r.id, name: maskName(b), x, win });
}

// Settles everything up to time t in a flying round.
function fly(r, t) {
  const until = Math.min(t, r.blastAt);
  const m = multAt(until - r.flyAt);
  for (const b of liveBets) {
    if (b.status !== 'pending') continue;
    const target = autoTarget(b);
    if (target <= r.point && target <= m) payOut(r, b, target, target === b.auto ? 'auto' : (target >= MAX_POINT ? 'max multiplier' : 'max win'), r.flyAt + msFor(target));
  }
  const cap = Number(cfg().roundCap) || 0;
  if (cap > 0 && t < r.blastAt) {
    const open = liveBets.filter(b => b.status === 'pending');
    const exposure = r.paid + open.reduce((s, b) => s + b.amount * m, 0);
    if (open.length && exposure >= cap && m >= MIN_CASHOUT) open.forEach(b => payOut(r, b, m, 'round limit', t));
  }
  if (t >= r.blastAt) blast(r);
}

function blast(r) {
  const at = r.blastAt;
  let lost = 0;
  for (const b of liveBets) {
    if (b.status !== 'pending') continue;
    b.status = 'lost';
    b.win_amount = 0;
    b.option = `Blasted ${r.point.toFixed(2)}x`;
    b.settled_at = new Date(at).toISOString();
    lost += 1;
  }
  for (const b of liveBets) b.result = r.point;
  r.phase = 'ended';
  r.endedAt = at;
  r.seed = seedAt(state.jet.chain, r.index);
  archive(r);
  if (walletsDirty) { wallet.persistWallets(); walletsDirty = false; }
  saveNow();
  emit('blast', { round: publicRound(r) });
  if (r.bets > 0) console.log(`[${LABEL}] ${r.id} blasted at ${r.point}x: staked ₹${r.staked}, paid ₹${r.paid} (${r.cashouts} cashed out, ${lost} lost)`);
}

function archive(r) {
  const j = state.jet;
  j.history.unshift({
    id: r.id, no: r.no, chainId: r.chainId, index: r.index, hash: r.hash, seed: r.seed, edge: r.edge,
    point: r.phase === 'void' ? null : r.point, phase: r.phase, createdAt: r.createdAt, flyAt: r.flyAt, endedAt: r.endedAt,
    bets: r.bets, players: r.players.length, staked: r.staked, paid: r.paid, cashouts: r.cashouts,
    refunded: r.refunded || 0, voidReason: r.voidReason || null
  });
  if (j.history.length > KEEP_HISTORY) j.history.length = KEEP_HISTORY;
  const d = istDateOf(r.createdAt);
  const day = j.daily[d] || (j.daily[d] = { rounds: 0, voided: 0 });
  if (r.phase === 'void') day.voided += 1; else day.rounds += 1;
  const keys = Object.keys(j.daily).sort();
  while (keys.length > 120) delete j.daily[keys.shift()];
}

// Gives every open stake of a round back (server restart mid-flight, or the jet being switched off before take-off).
function refundOpen(list, reason, t) {
  let count = 0, amount = 0;
  for (const b of list) {
    if (b.status !== 'pending') continue;
    wallet.refundStake(wallet.findUser(b.mobile), b, `Refund: ${LABEL} ${b.roundId} — ${reason}`);
    b.status = 'refunded';
    b.refunded_at = new Date(t).toISOString();
    b.refund_reason = reason;
    count += 1; amount += b.amount;
  }
  if (count) walletsDirty = true;
  return { count, amount: wallet.round2(amount) };
}

function voidRound(r, reason, t) {
  const res = refundOpen(liveBets, reason, t);
  r.phase = 'void';
  r.voidReason = reason;
  r.refunded = res.amount;
  r.endedAt = t;
  r.seed = seedAt(state.jet.chain, r.index);
  archive(r);
  return res;
}

function canStart() { return cfg().enabled !== false; }

let lastTick = 0;
function tick() {
  const t = now();
  lastTick = t;
  const j = state.jet;
  for (let guard = 0; guard < 5; guard++) {
    const r = j.round;
    if (!r) {
      if (!canStart()) break;
      startRound(t);
      continue;
    }
    if (r.phase === 'betting') {
      if (t < r.bettingEndsAt) break;
      r.phase = 'flying';
      r.flyAt = r.bettingEndsAt;
      r.blastAt = r.flyAt + msFor(r.point);
      markDirty();
      emit('fly', { round: publicRound(r) });
      continue;
    }
    if (r.phase === 'flying') {
      fly(r, t);
      if (r.phase === 'flying') break;
      continue;
    }
    // ended or void: wait out the pause, then start the next round (or stop when switched off)
    if (t < r.endedAt + PAUSE_MS) break;
    j.round = null;
    liveBets = [];
    if (!canStart()) {
      const res = refundOpen(nextBets, 'the game was paused', t);
      nextBets = [];
      if (res.count) saveNow();
      markDirty();
      emit('paused', {});
      break;
    }
  }
  if (walletsDirty) { wallet.persistWallets(); walletsDirty = false; saveNow(); }
}

let handle = null, betsHandle = null;
function startJet() {
  if (handle) return;
  ensureChain();
  const r = state.jet.round;
  rebuildIndex();
  if (r && r.phase === 'flying') {
    const res = voidRound(r, 'the server restarted during the flight', now());
    state.jet.round = null;
    liveBets = [];
    console.log(`[${LABEL}] ${r.id} voided after a restart: refunded ₹${res.amount} on ${res.count} bets`);
  } else if (r && r.phase === 'betting') {
    r.bettingEndsAt = Math.max(r.bettingEndsAt, now() + 3000); // give players a moment after the restart
  }
  if (walletsDirty) { wallet.persistWallets(); walletsDirty = false; }
  saveNow();
  tick();
  handle = setInterval(() => { try { tick(); } catch (e) { console.error(`[${LABEL}] tick error:`, e); } }, 50);
  betsHandle = setInterval(() => {
    if (betsDirty && state.jet.round) { betsDirty = false; emit('bets', liveBetsPayload()); }
  }, 500);
  if (handle.unref) handle.unref();
  if (betsHandle.unref) betsHandle.unref();
}
function stopJet() {
  if (handle) clearInterval(handle);
  if (betsHandle) clearInterval(betsHandle);
  handle = betsHandle = null;
}

// ---------- player actions ----------
function checkSlot(slot) {
  const s = parseInt(slot, 10);
  if (s !== 1 && s !== 2) throw new GameError(400, 'Choose bet 1 or bet 2');
  return s;
}

function placeBet(mobile, body = {}) {
  if (cfg().enabled === false) throw new GameError(400, `${LABEL} is paused right now. Please try again later.`);
  tick();
  const slot = checkSlot(body.slot);
  const amount = Number(body.amount);
  const c = cfg();
  if (!Number.isFinite(amount) || amount <= 0 || Math.floor(amount) !== amount) throw new GameError(400, 'Bet amount must be whole rupees');
  if (amount < c.minBet) throw new GameError(400, `Minimum bet is ${inr(c.minBet)}`);
  if (amount > c.maxBet) throw new GameError(400, `Maximum bet is ${inr(c.maxBet)}`);
  let auto = null;
  if (body.autoCashout !== undefined && body.autoCashout !== null && body.autoCashout !== '') {
    auto = floor2(Number(body.autoCashout));
    if (!Number.isFinite(auto) || auto < MIN_CASHOUT || auto > MAX_POINT) throw new GameError(400, `Auto cash-out must be between ${MIN_CASHOUT.toFixed(2)}x and ${MAX_POINT}x`);
  }

  const t = now();
  const r = state.jet.round;
  const current = r && r.phase === 'betting' && t < r.bettingEndsAt;
  const roundId = current ? r.id : nextId();
  const list = current ? liveBets : nextBets;
  const clean = wallet.cleanMobile(mobile);
  if (list.some(b => b.mobile === clean && b.slot === slot && b.status !== 'refunded')) {
    throw new GameError(400, `Bet ${slot} is already placed for ${current ? 'this' : 'the next'} round`);
  }

  const u = wallet.findUser(clean);
  const blockMsg = wallet.checkCanBet(u, clean);
  if (blockMsg) throw new GameError(403, blockMsg);
  const split = wallet.deductStake(u, amount);
  if (!split) throw new GameError(400, `Insufficient balance. Need ${inr(amount)}.`);

  const bet = {
    id: `jet_${t}_${crypto.randomInt(1e9)}`, game: 'jet', roundId, slot,
    mobile: clean, user: u.name || `User ${clean.slice(-4)}`,
    option: `Bet ${slot}`, amount, auto, multiplier: null, cashout: null,
    potential_win: null, ...wallet.shareOf(split, amount, amount),
    status: 'pending', win_amount: 0, result: null, created_at: new Date(t).toISOString()
  };
  state.bets.push(bet);
  list.push(bet);
  if (current) addToRound(r, bet);
  betsDirty = true;
  wallet.persistWallets();
  saveNow();
  return { bet, roundId, queued: !current, balances: wallet.balances(u) };
}

function cancelBet(mobile, body = {}) {
  tick();
  const slot = checkSlot(body.slot);
  const clean = wallet.cleanMobile(mobile);
  const t = now();
  const r = state.jet.round;
  let bet = nextBets.find(b => b.mobile === clean && b.slot === slot && b.status === 'pending');
  let inRound = false;
  if (!bet && r) {
    bet = liveBets.find(b => b.mobile === clean && b.slot === slot && b.status === 'pending');
    inRound = !!bet;
    if (bet && !(r.phase === 'betting' && t < r.bettingEndsAt)) throw new GameError(400, 'Too late to cancel: the jet has taken off. Cash out instead.');
  }
  if (!bet) throw new GameError(400, `No bet ${slot} to cancel`);
  const u = wallet.findUser(clean);
  wallet.refundStake(u, bet, `Refund: ${LABEL} ${bet.roundId} bet cancelled`);
  bet.status = 'refunded';
  bet.refunded_at = new Date(t).toISOString();
  bet.refund_reason = 'Cancelled by player';
  if (inRound) removeFromRound(r, bet);
  else nextBets = nextBets.filter(b => b !== bet);
  betsDirty = true;
  wallet.persistWallets();
  saveNow();
  return { cancelled: bet, balances: wallet.balances(u) };
}

function cashOut(mobile, body = {}) {
  tick();
  const slot = checkSlot(body.slot);
  const clean = wallet.cleanMobile(mobile);
  const r = state.jet.round;
  const mine = r ? liveBets.find(b => b.mobile === clean && b.slot === slot && b.status !== 'refunded') : null;
  if (!mine) throw new GameError(400, `No bet ${slot} in this round`);
  if (mine.status === 'won') throw new GameError(400, `Bet ${slot} already cashed out at ${mine.cashout.toFixed(2)}x`);
  if (mine.status === 'lost' || r.phase !== 'flying') {
    if (r.phase === 'betting') throw new GameError(400, 'The jet has not taken off yet');
    throw new GameError(400, `Too late: the jet blasted at ${r.point.toFixed(2)}x`);
  }
  const t = now();
  if (t >= r.blastAt) { fly(r, t); throw new GameError(400, `Too late: the jet blasted at ${r.point.toFixed(2)}x`); }
  const m = multAt(t - r.flyAt);
  if (m < MIN_CASHOUT) throw new GameError(400, `Cash-out opens at ${MIN_CASHOUT.toFixed(2)}x`);
  payOut(r, mine, m, 'manual', t);
  wallet.persistWallets();
  walletsDirty = false;
  saveNow();
  const u = wallet.findUser(clean);
  return { bet: mine, x: m, win: mine.win_amount, balances: u ? wallet.balances(u) : null };
}

// ---------- read models ----------
function publicRound(r) {
  if (!r) return { phase: cfg().enabled === false ? 'paused' : 'waiting' };
  const ended = r.phase === 'ended' || r.phase === 'void';
  return {
    id: r.id, no: r.no, phase: r.phase, hash: r.hash, edge: r.edge,
    bettingEndsAt: r.bettingEndsAt, flyAt: r.flyAt,
    point: ended && r.phase !== 'void' ? r.point : null,
    seed: ended ? r.seed : null,
    endedAt: r.endedAt, nextAt: ended ? r.endedAt + PAUSE_MS : null
  };
}

const maskName = b => {
  const n = String(b.user || 'Player').replace(/\s+/g, '');
  return `${n.slice(0, 2)}***${b.mobile.slice(-2)}`;
};

function liveBetsPayload() {
  const r = state.jet.round;
  const list = liveBets.filter(b => b.status !== 'refunded')
    .sort((a, b) => (b.win_amount || 0) - (a.win_amount || 0) || b.amount - a.amount)
    .slice(0, 60)
    .map(b => ({ name: maskName(b), amount: b.amount, cashout: b.cashout, win: b.win_amount, status: b.status }));
  return {
    roundId: r ? r.id : null,
    count: r ? r.bets : 0, players: r ? r.players.length : 0, staked: r ? r.staked : 0,
    bets: list
  };
}

function limitsPayload() {
  const c = cfg();
  return {
    enabled: c.enabled !== false, minBet: c.minBet, maxBet: c.maxBet, maxWin: c.maxWin,
    bettingSec: c.bettingSec, edgePct: Math.round(c.edge * 10000) / 100, roundCap: Number(c.roundCap) || 0,
    maxPoint: MAX_POINT, minCashout: MIN_CASHOUT, growth: GROWTH, pauseMs: PAUSE_MS
  };
}

function rulesText() {
  const c = limitsPayload();
  const lines = [
    `Each round, betting is open for ${c.bettingSec} seconds. Then the jet takes off at 1.00x and the multiplier climbs.`,
    'Cash out any time before the jet blasts to win your bet × the multiplier at that moment. If it blasts first, the bet is lost.',
    `The blast point is fixed before betting opens and never depends on bets. Blast point = ${(1 - c.edgePct / 100).toFixed(2)} ÷ (1 − r), rounded down to 2 decimals, from 1.00x up to ${c.maxPoint}x.`,
    `This gives a ${c.edgePct}% house edge: on average ₹${(100 - c.edgePct).toFixed(0)} of every ₹100 bet comes back to players, whatever cash-out they choose. About ${(100 - (100 - c.edgePct) / 1.01).toFixed(1)}% of rounds blast at 1.00x.`,
    `Auto cash-out pays exactly its target (from ${c.minCashout.toFixed(2)}x) if the jet reaches it. A cash-out at exactly the blast point wins.`,
    `Bets: ${inr(c.minBet)} to ${inr(c.maxBet)}, up to 2 bets per round. Maximum win ${inr(c.maxWin)} per bet: a bet cashes out by itself when it reaches it.`,
    'Check any round: before it starts you see its code, SHA-256(seed). After the blast the seed is shown; r comes from HMAC-SHA256(seed, salt). Use Verify on a past round.',
    `If the jet reaches ${c.maxPoint}x, every bet still flying cashes out at ${c.maxPoint}x.`,
    'If the server restarts during a flight, that round is cancelled and every open bet is refunded.'
  ];
  if (c.roundCap > 0) lines.splice(6, 0, `If total wins in one round reach ${inr(c.roundCap)}, every open bet cashes out at that moment.`);
  return lines;
}

function fairnessInfo() {
  const ch = state.jet.chain;
  return {
    terminatingHash: ch ? ch.terminatingHash : null, salt: ch ? ch.salt : null, chainId: ch ? ch.id : null,
    chainLength: ch ? ch.length : CHAIN_LENGTH,
    oldChains: (state.jet.oldChains || []).slice(0, 5).map(o => ({ id: o.id, terminatingHash: o.terminatingHash, salt: o.salt, startNo: o.startNo, endNo: o.endNo })),
    formula: 'r = first 13 hex digits of HMAC-SHA256(key = seed, message = salt) ÷ 2^52; blast = max(1.00, min(2000, floor(100 × (1 − edge) ÷ (1 − r)) ÷ 100))'
  };
}

function getPublicState() {
  tick();
  return {
    label: LABEL, serverTime: now(), config: limitsPayload(),
    round: publicRound(state.jet.round),
    history: state.jet.history.filter(h => h.phase === 'ended').slice(0, 30).map(h => ({ id: h.id, point: h.point })),
    live: liveBetsPayload(),
    fairness: fairnessInfo(),
    ruleLine: RULE_LINE,
    rules: rulesText()
  };
}

function getLobby() {
  const r = state.jet.round;
  const last = state.jet.history.find(h => h.phase === 'ended');
  return {
    label: LABEL, enabled: cfg().enabled !== false, serverTime: now(), growth: GROWTH,
    round: publicRound(r), lastPoint: last ? last.point : null,
    recent: state.jet.history.filter(h => h.phase === 'ended').slice(0, 5).map(h => h.point)
  };
}

function getMyBets(mobile, limit = 100) {
  const clean = wallet.cleanMobile(mobile);
  const r = state.jet.round;
  const mine = state.bets.filter(b => b.game === 'jet' && b.mobile === clean)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const active = [...liveBets, ...nextBets]
    .filter(b => b.mobile === clean && b.status !== 'refunded')
    .filter(b => (r && b.roundId === r.id) || b.status === 'pending')
    .map(b => ({ id: b.id, slot: b.slot, roundId: b.roundId, amount: b.amount, auto: b.auto, status: b.status, cashout: b.cashout, win: b.win_amount, queued: !r || b.roundId !== r.id }));
  const u = wallet.findUser(clean);
  return { bets: mine.slice(0, limit), active, roundId: r ? r.id : null, balances: u ? wallet.balances(u) : null };
}

// Everything a player needs to check one past round.
function getRoundProof(id) {
  const h = state.jet.history.find(x => x.id === id || String(x.no) === String(id));
  if (!h) throw new GameError(404, 'Round not found (only the last rounds are kept for checking)');
  const ch = state.jet.chain && state.jet.chain.id === h.chainId ? state.jet.chain : (state.jet.oldChains || []).find(o => o.id === h.chainId);
  return {
    id: h.id, no: h.no, hash: h.hash, seed: h.seed, edge: h.edge, point: h.point, phase: h.phase,
    salt: ch ? ch.salt : null, terminatingHash: ch ? ch.terminatingHash : null, chainIndex: h.index
  };
}

// ---------- admin ----------
function istDayStartMs(t) {
  return Math.floor((t + IST_OFFSET_MS) / 86400000) * 86400000 - IST_OFFSET_MS;
}

function betsOn(date) { return state.bets.filter(b => b.game === 'jet' && istDateOf(b.created_at) === date); }

function aggregate(list) {
  let staked = 0, paid = 0, refunded = 0, bets = 0, wins = 0, open = 0;
  const players = new Set();
  for (const b of list) {
    if (b.status === 'refunded') { refunded += b.amount; continue; }
    bets += 1; staked += b.amount; paid += b.win_amount || 0; players.add(b.mobile);
    if (b.status === 'won') wins += 1;
    if (b.status === 'pending') open += 1;
  }
  return {
    bets, players: players.size, staked: wallet.round2(staked), paid: wallet.round2(paid),
    net: wallet.round2(staked - paid), refunded: wallet.round2(refunded), wins, open,
    edgePct: staked > 0 ? Math.round((staked - paid) / staked * 10000) / 100 : null
  };
}

function getAdminOverview(date) {
  tick();
  const t = now();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) ? date : istDateOf(t);
  const r = state.jet.round;
  const day = state.jet.daily[d] || { rounds: 0, voided: 0 };
  const ch = state.jet.chain;
  let roundInfo = publicRound(r);
  if (r) {
    const open = liveBets.filter(b => b.status === 'pending');
    roundInfo = {
      ...roundInfo, bets: r.bets, players: r.players.length, staked: r.staked, paid: r.paid, cashouts: r.cashouts,
      openBets: open.length, openStake: wallet.round2(open.reduce((s, b) => s + b.amount, 0)),
      multiplier: r.phase === 'flying' ? multAt(t - r.flyAt) : null
    };
  }
  const recent = state.jet.history.filter(h => h.phase === 'ended').slice(0, 1000);
  const last14 = aggregate(state.bets.filter(b => b.game === 'jet' && new Date(b.created_at).getTime() >= istDayStartMs(t) - 13 * 86400000));
  return {
    label: LABEL, serverTime: t, date: d, config: { ...cfg() }, limits: limitsPayload(),
    round: roundInfo, queuedBets: nextBets.length,
    day: { ...aggregate(betsOn(d)), rounds: day.rounds, voided: day.voided },
    last14,
    recentPoints: {
      rounds: recent.length,
      instant: recent.filter(h => h.point <= 1).length,
      over10: recent.filter(h => h.point >= 10).length,
      over100: recent.filter(h => h.point >= 100).length,
      max: recent.reduce((m, h) => Math.max(m, h.point || 0), 0)
    },
    chain: ch ? { id: ch.id, terminatingHash: ch.terminatingHash, salt: ch.salt, length: ch.length, used: state.jet.nextIndex - 1, remaining: ch.length - state.jet.nextIndex + 1, createdAt: ch.createdAt } : null,
    configLog: (state.jet.configLog || []).slice(0, 15),
    rules: rulesText()
  };
}

function getAdminRounds({ date, limit = 100, offset = 0, withBetsOnly = false } = {}) {
  let list = state.jet.history;
  if (date) list = list.filter(h => istDateOf(h.createdAt) === date);
  if (withBetsOnly) list = list.filter(h => h.bets > 0);
  return {
    total: list.length,
    rounds: list.slice(offset, offset + limit).map(h => ({ ...h, net: wallet.round2((h.staked || 0) - (h.paid || 0)) }))
  };
}

function getAdminBets({ roundId, mobile, status, date, limit = 500 } = {}) {
  const clean = mobile ? wallet.cleanMobile(mobile) : null;
  return state.bets
    .filter(b => b.game === 'jet' && (!roundId || b.roundId === roundId) && (!clean || b.mobile === clean)
      && (!status || b.status === status) && (!date || istDateOf(b.created_at) === date))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit);
}

function getDailyReport(days = 14) {
  const t = now();
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = istDateOf(t - i * 86400000);
    const day = state.jet.daily[d] || { rounds: 0, voided: 0 };
    out.push({ date: d, rounds: day.rounds, voided: day.voided, ...aggregate(betsOn(d)) });
  }
  return out;
}

function updateConfig(body = {}, by = 'admin') {
  const c = cfg();
  const next = { ...c };
  const num = v => (v === undefined || v === null || v === '' ? undefined : Number(v));
  if (body.enabled !== undefined) next.enabled = !!body.enabled;
  const minBet = num(body.minBet), maxBet = num(body.maxBet), maxWin = num(body.maxWin);
  const bettingSec = num(body.bettingSec), roundCap = num(body.roundCap);
  let edge = num(body.edgePct);
  if (edge !== undefined) edge = edge / 100;
  if (edge === undefined && body.edge !== undefined) edge = num(body.edge);
  if (minBet !== undefined) { if (!Number.isInteger(minBet) || minBet < 1) throw new GameError(400, 'Minimum bet must be a whole number of at least ₹1'); next.minBet = minBet; }
  if (maxBet !== undefined) { if (!Number.isInteger(maxBet) || maxBet < 1) throw new GameError(400, 'Maximum bet must be a whole number'); next.maxBet = maxBet; }
  if (maxWin !== undefined) { if (!Number.isFinite(maxWin) || maxWin < 1) throw new GameError(400, 'Max win must be a positive amount'); next.maxWin = Math.floor(maxWin); }
  if (bettingSec !== undefined) { if (!Number.isFinite(bettingSec) || bettingSec < 5 || bettingSec > 30) throw new GameError(400, 'Betting window must be 5 to 30 seconds'); next.bettingSec = Math.round(bettingSec); }
  if (roundCap !== undefined) { if (!Number.isFinite(roundCap) || roundCap < 0) throw new GameError(400, 'Round limit must be 0 (off) or a positive amount'); next.roundCap = Math.floor(roundCap); }
  if (edge !== undefined) { if (!Number.isFinite(edge) || edge < 0.01 || edge > 0.1) throw new GameError(400, 'House edge must be between 1% and 10%'); next.edge = Math.round(edge * 10000) / 10000; }
  if (next.maxBet < next.minBet) throw new GameError(400, 'Maximum bet must be at least the minimum bet');
  if (next.maxWin < next.maxBet * MIN_CASHOUT) throw new GameError(400, `Max win must be at least ${MIN_CASHOUT}× the maximum bet`);
  if (next.roundCap > 0 && next.roundCap < next.maxWin) throw new GameError(400, 'Round limit must be at least the max win per bet (or 0 for off)');

  const changes = {};
  for (const k of ['enabled', 'minBet', 'maxBet', 'maxWin', 'bettingSec', 'roundCap', 'edge']) {
    if (next[k] !== c[k]) changes[k] = { from: c[k], to: next[k] };
  }
  if (Object.keys(changes).length) {
    Object.assign(c, next);
    state.jet.configLog.unshift({ at: new Date(now()).toISOString(), by, changes });
    if (state.jet.configLog.length > 50) state.jet.configLog.length = 50;
    saveNow();
    emit('config', { config: limitsPayload() });
  }
  return { config: { ...c }, changes };
}

module.exports = {
  LABEL, RULE_LINE, GROWTH, MAX_POINT, MIN_CASHOUT, PAUSE_MS,
  setClock, now, sha256, seedAt, blastPoint, multAt, msFor, ensureChain, newChain,
  tick, startJet, stopJet, rebuildIndex, subscribe,
  placeBet, cancelBet, cashOut,
  getPublicState, getLobby, getMyBets, getRoundProof, fairnessInfo, rulesText, liveBetsPayload,
  getAdminOverview, getAdminRounds, getAdminBets, getDailyReport, updateConfig, istDateOf
};
