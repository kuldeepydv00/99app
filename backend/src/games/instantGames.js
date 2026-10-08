// Dice and Mines: instant games against the house, provably fair.
//
// Fairness (shown to players):
//   - every player has a server seed (kept secret, its SHA-256 hash is shown), a client seed they can change,
//     and a nonce that goes up by one per bet;
//   - results come from HMAC-SHA256(server seed, "clientSeed:nonce:round"), read 4 bytes at a time as numbers in [0, 1);
//   - changing the seed pair reveals the old server seed, so every past bet can be checked.
// Results never depend on who bets or how much, and nothing here lets anyone pick a result.
//
// House edge (admin setting, default 10%): every payout is (1 - edge) x the fair odds, so on average the house
// keeps `edge` of all money bet. Single bets can still win; the max-profit limit caps how much one bet can win.
const crypto = require('crypto');
const { state, saveNow } = require('./gamesStore');
const wallet = require('./wallet');
const { GameError, istDateOf } = require('./tradingEngine');

const LABELS = { dice: 'Dice', mines: 'Mines' };
const TILES = 25;
const DICE_MIN_CHANCE = 0.01;      // %
const MIN_MULTIPLIER = 1.0102;     // a winning dice bet always pays more than the stake
const KEEP_FINISHED_SEEDS = 5;

const DEFAULTS = {
  dice: { enabled: true, edge: 0.10, minBet: 10, maxBet: 10000, maxProfit: 50000 },
  mines: { enabled: true, edge: 0.10, minBet: 10, maxBet: 10000, maxProfit: 50000 }
};

let nowFn = () => Date.now();
function setClock(fn) { nowFn = fn || (() => Date.now()); }
const now = () => nowFn();

// ---------- store ----------
function store() {
  if (!state.instant) state.instant = {};
  const s = state.instant;
  if (!s.config) s.config = {};
  for (const g of Object.keys(DEFAULTS)) s.config[g] = { ...DEFAULTS[g], ...(s.config[g] || {}) };
  if (!s.seeds) s.seeds = {};       // mobile -> seed pair
  if (!s.active) s.active = {};     // mobile -> active Mines game (mine positions stay here, never sent)
  if (!s.configLog) s.configLog = [];
  return s;
}
const cfg = game => store().config[game];

const money = n => Math.floor((Number(n) || 0) * 100 + 1e-6) / 100;
const floor2 = n => Math.floor(n * 100 + 1e-9) / 100;
const floor4 = n => Math.floor(n * 10000 + 1e-9) / 10000;
const inr = n => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const sha256 = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const edgePct = game => Math.round(cfg(game).edge * 10000) / 100;

// ---------- provably fair ----------
function newSeedPair(clientSeed) {
  const server = crypto.randomBytes(32).toString('hex');
  return { server, hash: sha256(server), client: clientSeed || crypto.randomBytes(8).toString('hex'), nonce: 0, createdAt: new Date(now()).toISOString() };
}

function seedsOf(mobile) {
  const s = store();
  if (!s.seeds[mobile]) s.seeds[mobile] = { current: newSeedPair(), previous: [] };
  return s.seeds[mobile];
}

// count numbers in [0, 1) from HMAC-SHA256(server, `${client}:${nonce}:${round}`), 8 per round of 32 bytes
function floats(server, client, nonce, count) {
  const out = [];
  for (let round = 0; out.length < count; round++) {
    const buf = crypto.createHmac('sha256', server).update(`${client}:${nonce}:${round}`).digest();
    for (let i = 0; i < 32 && out.length < count; i += 4) {
      out.push(buf[i] / 256 + buf[i + 1] / 256 ** 2 + buf[i + 2] / 256 ** 3 + buf[i + 3] / 256 ** 4);
    }
  }
  return out;
}

// Dice roll 0.00 - 100.00
function diceRoll(server, client, nonce) {
  return Math.floor(floats(server, client, nonce, 1)[0] * 10001) / 100;
}

// Mine tiles (0-24): shuffle the 25 tiles with the floats; the first `mines` tiles are mines.
function mineTiles(server, client, nonce, mines) {
  const fl = floats(server, client, nonce, TILES - 1);
  const tiles = Array.from({ length: TILES }, (_, i) => i);
  const order = [];
  for (let i = 0; i < TILES - 1; i++) {
    const k = Math.floor(fl[i] * (TILES - i));
    order.push(tiles.splice(k, 1)[0]);
  }
  order.push(tiles[0]);
  return order.slice(0, mines).sort((a, b) => a - b);
}

// Takes the next nonce of the player's current seed pair.
function nextNonce(mobile) {
  const p = seedsOf(mobile).current;
  const nonce = p.nonce;
  p.nonce += 1;
  return { server: p.server, hash: p.hash, client: p.client, nonce };
}

// ---------- maths ----------
// Dice: multiplier for a win chance (in %), 4 decimals, house edge taken off
function diceMultiplier(chance, edge) { return floor4((100 * (1 - edge)) / chance); }
function diceMaxChance(edge) { return Math.floor(((100 * (1 - edge)) / MIN_MULTIPLIER) * 100) / 100; }

function choose(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
}
// Mines: multiplier after `safe` safe picks with `mines` mines, house edge taken off
function minesMultiplier(mines, safe, edge) {
  if (safe <= 0) return 1;
  return floor2((1 - edge) * choose(TILES, safe) / choose(TILES - mines, safe));
}

// ---------- saving ----------
// Dice can be played several times a second, and both stores are whole-file writes, so wallets and the
// games store are written together at most once a second (and on exit). Settings changes save at once.
let persistTimer = null, lastPersist = 0;
function flush() {
  if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
  lastPersist = Date.now();
  wallet.persistWallets();
  saveNow();
}
function persist() {
  if (persistTimer) return;
  const since = Date.now() - lastPersist;
  if (since >= 1000) { flush(); return; }
  persistTimer = setTimeout(flush, 1000 - since);
  if (persistTimer.unref) persistTimer.unref();
}
process.on('exit', () => { if (persistTimer) flush(); });

// ---------- shared checks ----------
function checkAmount(game, amount) {
  const c = cfg(game);
  if (c.enabled === false) throw new GameError(400, `${LABELS[game]} is paused right now. Please try again later.`);
  if (!Number.isFinite(amount) || amount <= 0 || Math.floor(amount) !== amount) throw new GameError(400, 'Bet amount must be whole rupees');
  if (amount < c.minBet) throw new GameError(400, `Minimum bet is ${inr(c.minBet)}`);
  if (amount > c.maxBet) throw new GameError(400, `Maximum bet is ${inr(c.maxBet)}`);
}

function takeStake(mobile, amount) {
  const u = wallet.findUser(mobile);
  const blockMsg = wallet.checkCanBet(u, mobile);
  if (blockMsg) throw new GameError(403, blockMsg);
  const split = wallet.deductStake(u, amount);
  if (!split) throw new GameError(400, `Insufficient balance. Need ${inr(amount)}.`);
  return { u, split };
}

const userName = (u, mobile) => (u && u.name) || `User ${mobile.slice(-4)}`;

// ---------- Dice ----------
function playDice(mobile, body = {}) {
  const clean = wallet.cleanMobile(mobile);
  const amount = Number(body.amount);
  checkAmount('dice', amount);
  const c = cfg('dice');
  const mode = body.mode === 'under' ? 'under' : 'over';
  const target = Math.round(Number(body.target) * 100) / 100;
  const maxChance = diceMaxChance(c.edge);
  // roll over T wins on rolls above T; roll under T wins on rolls below T
  const chance = mode === 'over' ? Math.round((100 - target) * 100) / 100 : target;
  if (!Number.isFinite(target) || chance < DICE_MIN_CHANCE || chance > maxChance) {
    throw new GameError(400, `Win chance must be between ${DICE_MIN_CHANCE}% and ${maxChance}%`);
  }
  const multiplier = diceMultiplier(chance, c.edge);
  const payout = money(amount * multiplier);
  if (payout - amount > c.maxProfit) {
    throw new GameError(400, `Max profit per bet is ${inr(c.maxProfit)}. Lower the bet or the multiplier.`);
  }

  const { u, split } = takeStake(clean, amount);
  const seed = nextNonce(clean);
  const roll = diceRoll(seed.server, seed.client, seed.nonce);
  const won = mode === 'over' ? roll > target : roll < target;
  const t = now();
  const bet = {
    id: `dice_${t}_${crypto.randomInt(1e9)}`, game: 'dice', roundId: null,
    mobile: clean, user: userName(u, clean),
    option: `Roll ${mode} ${target.toFixed(2)}`, mode, target, chance, multiplier,
    amount, potential_win: payout, ...wallet.shareOf(split, amount, amount),
    result: roll.toFixed(2), status: won ? 'won' : 'lost', win_amount: won ? payout : 0,
    edge: c.edge, serverHash: seed.hash, clientSeed: seed.client, nonce: seed.nonce,
    created_at: new Date(t).toISOString(), settled_at: new Date(t).toISOString()
  };
  state.bets.push(bet);
  if (won) wallet.creditWin(u, payout, `Won ${inr(payout)} on Dice (roll ${roll.toFixed(2)}, ${multiplier}x)`, istDateOf(t));
  persist();
  return { bet: publicBet(bet), roll, won, multiplier, payout: bet.win_amount, balances: wallet.balances(u), nonce: seed.nonce };
}

// ---------- Mines ----------
function publicMinesGame(g, reveal) {
  if (!g) return null;
  const c = g.edge;
  const safe = g.picks.length;
  const multiplier = minesMultiplier(g.mines, safe, c);
  const next = safe < TILES - g.mines ? minesMultiplier(g.mines, safe + 1, c) : null;
  return {
    id: g.id, amount: g.amount, mines: g.mines, picks: g.picks, status: g.status,
    multiplier, next, cashout: money(Math.min(g.amount * multiplier, g.amount + g.maxProfit)),
    hit: g.hit ?? null, minesAt: reveal ? g.minesAt : null,
    serverHash: g.serverHash, clientSeed: g.clientSeed, nonce: g.nonce, createdAt: g.createdAt
  };
}

function startMines(mobile, body = {}) {
  const clean = wallet.cleanMobile(mobile);
  const s = store();
  if (s.active[clean]) throw new GameError(400, 'Finish your current Mines game first');
  const amount = Number(body.amount);
  checkAmount('mines', amount);
  const mines = parseInt(body.mines, 10);
  if (!Number.isInteger(mines) || mines < 1 || mines > 24) throw new GameError(400, 'Choose 1 to 24 mines');
  const c = cfg('mines');

  const { u, split } = takeStake(clean, amount);
  const seed = nextNonce(clean);
  const t = now();
  const id = `mines_${t}_${crypto.randomInt(1e9)}`;
  const bet = {
    id, game: 'mines', roundId: null, mobile: clean, user: userName(u, clean),
    option: `${mines} mine${mines === 1 ? '' : 's'}`, mines, picks: [], amount, multiplier: null,
    potential_win: null, ...wallet.shareOf(split, amount, amount),
    result: null, status: 'pending', win_amount: 0,
    edge: c.edge, serverHash: seed.hash, clientSeed: seed.client, nonce: seed.nonce,
    created_at: new Date(t).toISOString()
  };
  state.bets.push(bet);
  s.active[clean] = {
    id, amount, mines, picks: [], status: 'playing', edge: c.edge, maxProfit: c.maxProfit,
    minesAt: mineTiles(seed.server, seed.client, seed.nonce, mines),
    serverHash: seed.hash, clientSeed: seed.client, nonce: seed.nonce, createdAt: bet.created_at
  };
  persist();
  return { game: publicMinesGame(s.active[clean], false), balances: wallet.balances(u) };
}

function betOf(id) { return state.bets.find(b => b.id === id); }

function finishMines(clean, g, won, t) {
  const s = store();
  const bet = betOf(g.id);
  const multiplier = minesMultiplier(g.mines, g.picks.length, g.edge);
  const payout = won ? money(Math.min(g.amount * multiplier, g.amount + g.maxProfit)) : 0;
  g.status = won ? 'cashed' : 'busted';
  if (bet) {
    bet.picks = g.picks.slice();
    bet.multiplier = won ? multiplier : 0;
    bet.status = won ? 'won' : 'lost';
    bet.win_amount = payout;
    bet.result = won ? `${g.picks.length} gem${g.picks.length === 1 ? '' : 's'} · ${multiplier}x` : `Mine at tile ${g.hit + 1}`;
    bet.minesAt = g.minesAt;
    bet.settled_at = new Date(t).toISOString();
  }
  const u = wallet.findUser(clean);
  if (won && payout > 0 && u) wallet.creditWin(u, payout, `Won ${inr(payout)} on Mines (${g.mines} mines, ${g.picks.length} gems, ${multiplier}x)`, istDateOf(t));
  delete s.active[clean];
  persist();
  return { game: publicMinesGame(g, true), payout, balances: u ? wallet.balances(u) : null };
}

function revealMine(mobile, body = {}) {
  const clean = wallet.cleanMobile(mobile);
  const g = store().active[clean];
  if (!g) throw new GameError(400, 'No Mines game in play. Place a bet first.');
  const tile = parseInt(body.tile, 10);
  if (!Number.isInteger(tile) || tile < 0 || tile >= TILES) throw new GameError(400, 'Pick a tile');
  if (g.picks.includes(tile)) throw new GameError(400, 'That tile is already open');
  const t = now();
  if (g.minesAt.includes(tile)) {
    g.hit = tile;
    return { ...finishMines(clean, g, false, t), hitMine: true };
  }
  g.picks.push(tile);
  const multiplier = minesMultiplier(g.mines, g.picks.length, g.edge);
  const allFound = g.picks.length >= TILES - g.mines;
  const capped = g.amount * multiplier - g.amount >= g.maxProfit;
  if (allFound || capped) return { ...finishMines(clean, g, true, t), hitMine: false, auto: allFound ? 'all gems found' : 'max profit reached' };
  persist();
  return { game: publicMinesGame(g, false), hitMine: false };
}

function cashOutMines(mobile) {
  const clean = wallet.cleanMobile(mobile);
  const g = store().active[clean];
  if (!g) throw new GameError(400, 'No Mines game in play');
  if (!g.picks.length) throw new GameError(400, 'Open at least one tile before cashing out');
  return finishMines(clean, g, true, now());
}

function getActiveMines(mobile) {
  const clean = wallet.cleanMobile(mobile);
  const u = wallet.findUser(clean);
  return { game: publicMinesGame(store().active[clean], false), balances: u ? wallet.balances(u) : null };
}

// ---------- fairness ----------
function getFairness(mobile) {
  const clean = wallet.cleanMobile(mobile);
  const p = seedsOf(clean);
  return {
    current: { serverHash: p.current.hash, clientSeed: p.current.client, nonce: p.current.nonce },
    previous: p.previous.map(x => ({ serverSeed: x.server, serverHash: x.hash, clientSeed: x.client, nonces: x.nonce, endedAt: x.endedAt })),
    howItWorks: [
      'Each bet uses HMAC-SHA256 with your server seed as the key and "clientSeed:nonce:round" as the message.',
      'The result is read 4 bytes at a time as numbers from 0 to 1.',
      'Dice: roll = floor(number × 10001) ÷ 100, so it is 0.00 to 100.00.',
      'Mines: the 25 tiles are shuffled with the numbers; the first tiles in the shuffle are the mines.',
      'Change your seeds to see the old server seed and check any past bet.'
    ]
  };
}

function rotateSeeds(mobile, body = {}) {
  const clean = wallet.cleanMobile(mobile);
  if (store().active[clean]) throw new GameError(400, 'Finish your Mines game before changing seeds');
  let client = body.clientSeed !== undefined ? String(body.clientSeed).trim() : '';
  if (client && !/^[A-Za-z0-9_-]{1,64}$/.test(client)) throw new GameError(400, 'Client seed: 1 to 64 letters, numbers, - or _');
  const p = seedsOf(clean);
  p.previous.unshift({ ...p.current, endedAt: new Date(now()).toISOString() });
  if (p.previous.length > KEEP_FINISHED_SEEDS) p.previous.length = KEEP_FINISHED_SEEDS;
  p.current = newSeedPair(client || undefined);
  persist();
  return getFairness(clean);
}

// Checks a past bet against its seeds (for players and admins).
function verify({ serverSeed, clientSeed, nonce, game, mines }) {
  const n = parseInt(nonce, 10);
  if (!serverSeed || !clientSeed || !Number.isInteger(n) || n < 0) throw new GameError(400, 'Enter server seed, client seed and nonce');
  const out = { serverHash: sha256(serverSeed) };
  if (game === 'mines') out.minesAt = mineTiles(String(serverSeed), String(clientSeed), n, Math.min(24, Math.max(1, parseInt(mines, 10) || 3)));
  else out.roll = diceRoll(String(serverSeed), String(clientSeed), n);
  return out;
}

// ---------- read models ----------
function limits(game) {
  const c = cfg(game);
  const out = { enabled: c.enabled !== false, edgePct: edgePct(game), minBet: c.minBet, maxBet: c.maxBet, maxProfit: c.maxProfit };
  if (game === 'dice') Object.assign(out, { minChance: DICE_MIN_CHANCE, maxChance: diceMaxChance(c.edge), rtpPct: Math.round((1 - c.edge) * 10000) / 100 });
  if (game === 'mines') Object.assign(out, { tiles: TILES, rtpPct: Math.round((1 - c.edge) * 10000) / 100 });
  return out;
}

function rulesText(game) {
  const l = limits(game);
  const common = [
    `House edge ${l.edgePct}%: on average ₹${(100 - l.edgePct).toFixed(0)} of every ₹100 bet comes back to players.`,
    `Bets: ${inr(l.minBet)} to ${inr(l.maxBet)}. Max profit per bet: ${inr(l.maxProfit)}.`,
    'Results come from your seeds (see Fairness), never from who bets or how much.'
  ];
  if (game === 'dice') {
    return [
      'Pick a target and roll over or under it. The roll is a number from 0.00 to 100.00.',
      `Payout = ${(100 - l.edgePct).toFixed(0)} ÷ win chance. Example: 50% chance pays ${diceMultiplier(50, cfg('dice').edge).toFixed(2)}x.`,
      `Win chance from ${l.minChance}% to ${l.maxChance}%.`,
      ...common
    ];
  }
  return [
    `There are ${TILES} tiles. Pick how many mines (1 to 24), then open tiles one by one.`,
    'Every gem raises your multiplier. Cash out any time; hit a mine and the bet is lost.',
    `Multiplier = ${(1 - cfg('mines').edge).toFixed(2)} × the fair odds of finding that many gems.`,
    'The game cashes out by itself when you find every gem or reach the max profit.',
    ...common
  ];
}

function getPublicState(game) {
  if (!LABELS[game]) throw new GameError(404, 'Unknown game');
  return { game, label: LABELS[game], serverTime: now(), config: limits(game), rules: rulesText(game) };
}

function getLobby() {
  return { dice: { label: LABELS.dice, ...limits('dice') }, mines: { label: LABELS.mines, ...limits('mines') } };
}

function publicBet(b) {
  const { minesAt, ...rest } = b;
  return b.status === 'pending' ? rest : b;
}

function getMyBets(mobile, limit = 100, game) {
  const clean = wallet.cleanMobile(mobile);
  return state.bets.filter(b => (game ? b.game === game : LABELS[b.game]) && b.mobile === clean)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit)
    .map(publicBet);
}

// ---------- admin ----------
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function istDayStartMs(t) { return Math.floor((t + IST_OFFSET_MS) / 86400000) * 86400000 - IST_OFFSET_MS; }

function aggregate(list) {
  let staked = 0, paid = 0, bets = 0, wins = 0, open = 0, openStake = 0, expected = 0;
  const players = new Set();
  for (const b of list) {
    if (b.status === 'refunded') continue;
    bets += 1; staked += b.amount; players.add(b.mobile);
    expected += b.amount * (b.edge || 0);
    if (b.status === 'won') { wins += 1; paid += b.win_amount || 0; }
    if (b.status === 'pending') { open += 1; openStake += b.amount; }
  }
  const settledStake = staked - openStake;
  return {
    bets, players: players.size, staked: wallet.round2(staked), paid: wallet.round2(paid),
    profit: wallet.round2(settledStake - paid), expectedProfit: wallet.round2(expected),
    wins, open, openStake: wallet.round2(openStake),
    actualEdgePct: settledStake > 0 ? Math.round((settledStake - paid) / settledStake * 10000) / 100 : null
  };
}

function betsOf(game, fromMs, toMs) {
  return state.bets.filter(b => b.game === game && (() => {
    const t = new Date(b.created_at).getTime();
    return (fromMs === undefined || t >= fromMs) && (toMs === undefined || t < toMs);
  })());
}

function getAdminOverview(game) {
  if (!LABELS[game]) throw new GameError(404, 'Unknown game');
  const t = now();
  const today = istDayStartMs(t);
  const all = state.bets.filter(b => b.game === game);
  const periods = {
    today: aggregate(all.filter(b => new Date(b.created_at).getTime() >= today)),
    days7: aggregate(all.filter(b => new Date(b.created_at).getTime() >= today - 6 * 86400000)),
    days30: aggregate(all.filter(b => new Date(b.created_at).getTime() >= today - 29 * 86400000)),
    allTime: aggregate(all)
  };
  // biggest single-bet results (for the admin to see risk)
  const settled = all.filter(b => b.status === 'won' || b.status === 'lost');
  const topWins = settled.filter(b => b.status === 'won').sort((a, b) => (b.win_amount - b.amount) - (a.win_amount - a.amount)).slice(0, 5)
    .map(b => ({ id: b.id, user: b.user, mobile: b.mobile, amount: b.amount, win_amount: b.win_amount, profit: wallet.round2(b.win_amount - b.amount), option: b.option, result: b.result, at: b.settled_at }));
  const activeGames = game === 'mines' ? Object.values(store().active).map(g => ({ id: g.id, amount: g.amount, mines: g.mines, picks: g.picks.length, at: g.createdAt })) : [];
  return {
    game, label: LABELS[game], serverTime: t, config: { ...cfg(game) }, limits: limits(game), periods, topWins, activeGames,
    configLog: store().configLog.filter(c => c.game === game).slice(0, 15), rules: rulesText(game)
  };
}

function getDailyReport(game, days = 14) {
  const t = now();
  const start = istDayStartMs(t);
  const out = [];
  for (let i = 0; i < days; i++) {
    const from = start - i * 86400000;
    out.push({ date: istDateOf(from + 3600000), ...aggregate(betsOf(game, from, from + 86400000)) });
  }
  return out;
}

function getAdminBets(game, { mobile, status, date, limit = 500 } = {}) {
  const clean = mobile ? wallet.cleanMobile(mobile) : null;
  return state.bets
    .filter(b => b.game === game && (!clean || b.mobile === clean) && (!status || b.status === status) && (!date || istDateOf(b.created_at) === date))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit);
}

function updateConfig(game, body = {}, by = 'admin') {
  if (!LABELS[game]) throw new GameError(404, 'Unknown game');
  const c = cfg(game);
  const next = { ...c };
  const num = v => (v === undefined || v === null || v === '' ? undefined : Number(v));
  if (body.enabled !== undefined) next.enabled = !!body.enabled;
  const minBet = num(body.minBet), maxBet = num(body.maxBet), maxProfit = num(body.maxProfit);
  let edge = num(body.edgePct);
  if (edge !== undefined) edge = edge / 100;
  if (minBet !== undefined) { if (!Number.isInteger(minBet) || minBet < 1) throw new GameError(400, 'Minimum bet must be a whole number of at least ₹1'); next.minBet = minBet; }
  if (maxBet !== undefined) { if (!Number.isInteger(maxBet) || maxBet < 1) throw new GameError(400, 'Maximum bet must be a whole number'); next.maxBet = maxBet; }
  if (maxProfit !== undefined) { if (!Number.isFinite(maxProfit) || maxProfit < 1) throw new GameError(400, 'Max profit must be a positive amount'); next.maxProfit = Math.floor(maxProfit); }
  if (edge !== undefined) { if (!Number.isFinite(edge) || edge < 0.01 || edge > 0.5) throw new GameError(400, 'House edge must be between 1% and 50%'); next.edge = Math.round(edge * 10000) / 10000; }
  if (next.maxBet < next.minBet) throw new GameError(400, 'Maximum bet must be at least the minimum bet');
  const changes = {};
  for (const k of ['enabled', 'minBet', 'maxBet', 'maxProfit', 'edge']) if (next[k] !== c[k]) changes[k] = { from: c[k], to: next[k] };
  if (Object.keys(changes).length) {
    Object.assign(c, next);
    const log = store().configLog;
    log.unshift({ at: new Date(now()).toISOString(), by, game, changes });
    if (log.length > 100) log.length = 100;
    saveNow();
  }
  return { config: { ...c }, limits: limits(game), changes };
}

store();

module.exports = {
  LABELS, TILES, DEFAULTS, setClock, now, flush,
  floats, diceRoll, mineTiles, diceMultiplier, diceMaxChance, minesMultiplier, choose, sha256,
  playDice, startMines, revealMine, cashOutMines, getActiveMines,
  getFairness, rotateSeeds, verify,
  getPublicState, getLobby, getMyBets, rulesText, limits,
  getAdminOverview, getDailyReport, getAdminBets, updateConfig, aggregate
};
