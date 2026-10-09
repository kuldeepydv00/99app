// Live players and the live bets feed.
//
// Live players: the website and the app ping every ~15 s with where the player is (the lobby,
// a game, or a market). A player counts as live in that place while their last ping is under
// 45 s old. Counts are always real logged-in players, one per account. Below the admin's
// cut-off (`minShow`, default 5) players see only a "Live" dot instead of the number.
//
// Live bets feed: read from the bets already stored (new games in gamesStore, Matka markets in
// store.memoryBets). Mobiles are masked (98••••••21). For games where the lowest total bet wins
// (Number / Card / Colour, Dragon Tiger, Toss, 99x Matka, Matka) the feed never shows what was
// picked, only how many picks, so it can't reveal how the bets are spread.
const { state, markDirty, MATKA99_MARKETS } = require('./gamesStore');
const wallet = require('./wallet');
const { memoryBets } = require('../store');

const TTL_MS = 45 * 1000;
const FEED_TTL_MS = 3000;
const LATEST_DAYS = 7;
const WINS_HOURS = 48;
const MAX_SCAN = 20000;

const MATKA_MARKETS = ['Shiv Parwati', 'Delhi Bazar', 'Dubai Market', 'Shree Ganesh', 'Faridabad', 'Ghaziabad', 'Gali', 'Desawar'];
const MATKA_ALIAS = { Disawer: 'Desawar', Disawar: 'Desawar', Desawer: 'Desawar', 'Shri Ganesh': 'Shree Ganesh' };
const GAME_KEYS = ['jet', 'mines', 'dice', 'dragontiger', 'toss', 'colour', 'number', 'card'];
const LABELS = {
  jet: '99x Jet', mines: 'Mines', dice: 'Dice', dragontiger: 'Dragon Tiger', toss: 'Toss',
  colour: 'Colour Trading', number: 'Number Trading', card: 'Card Trading', matka99: '99x Matka', matka: 'Matka'
};
// Games where the lowest total bet wins: never show the picks in the feed.
const HIDE_PICKS = new Set(['colour', 'number', 'card', 'dragontiger', 'toss', 'matka99', 'matka']);
const M99_NAME = Object.fromEntries(MATKA99_MARKETS.map(m => [m.key, m.name]));

const cfg = () => state.live.config;
const round2 = wallet.round2;
const ms = v => { const t = new Date(v).getTime(); return Number.isFinite(t) ? t : 0; };

function istDate(t) {
  return new Date(t + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

function maskMobile(m) {
  const s = wallet.cleanMobile(m);
  if (s.length < 6) return 'Player';
  return `${s.slice(0, 2)}${'•'.repeat(s.length - 4)}${s.slice(-2)}`;
}

function matkaMarket(name) {
  const n = String(name || '').trim();
  const k = MATKA_ALIAS[n] || n;
  return MATKA_MARKETS.includes(k) ? k : null;
}

// Turns what the client sends into a known place key; anything unknown is the lobby.
function normWhere(where) {
  const w = String(where || '').trim();
  if (GAME_KEYS.includes(w) || w === 'matka99' || w === 'matka') return w;
  const i = w.indexOf(':');
  if (i > 0) {
    const group = w.slice(0, i);
    const rest = w.slice(i + 1);
    if (group === 'matka') { const k = matkaMarket(rest); if (k) return `matka:${k}`; }
    if (group === 'matka99' && M99_NAME[rest]) return `matka99:${rest}`;
  }
  return 'lobby';
}

function whereLabel(w) {
  if (w === 'lobby') return 'Home / lobby';
  if (LABELS[w]) return LABELS[w];
  const [group, rest] = w.split(':');
  if (group === 'matka') return `Matka · ${rest}`;
  if (group === 'matka99') return `99x Matka · ${M99_NAME[rest] || rest}`;
  return w;
}

// ---------- presence ----------
const presence = new Map(); // mobile -> { where, platform, at, since }
let countsCache = null;     // { at, raw }

function rawCounts(now = Date.now()) {
  if (countsCache && now - countsCache.at < 1000) return countsCache.raw;
  const by = {};
  const platforms = { web: 0, android: 0 };
  let total = 0;
  for (const [m, p] of presence) {
    if (now - p.at > TTL_MS) { presence.delete(m); continue; }
    total += 1;
    platforms[p.platform] = (platforms[p.platform] || 0) + 1;
    by[p.where] = (by[p.where] || 0) + 1;
    const group = p.where.split(':')[0];
    if (group !== p.where) by[group] = (by[group] || 0) + 1; // 'matka' and 'matka99' add up their markets
  }
  const raw = { total, by, platforms };
  countsCache = { at: now, raw };
  return raw;
}

function notePeak(total, now) {
  const d = istDate(now);
  const peaks = state.live.peaks;
  if (!peaks[d] || total > peaks[d].total) {
    peaks[d] = { total, at: new Date(now).toISOString() };
    const keep = Object.keys(peaks).sort().slice(-30);
    for (const k of Object.keys(peaks)) if (!keep.includes(k)) delete peaks[k];
    markDirty();
  }
}

// What players see: real numbers at or above the cut-off, nothing below it (shown as "Live").
function publicCounts(now = Date.now()) {
  const c = cfg();
  if (!c.enabled) return { enabled: false, minShow: c.minShow, total: null, counts: {} };
  const { total, by } = rawCounts(now);
  const counts = {};
  for (const [k, n] of Object.entries(by)) if (n >= c.minShow) counts[k] = n;
  return { enabled: true, minShow: c.minShow, total: total >= c.minShow ? total : null, counts };
}

function ping(mobile, where, platform, now = Date.now()) {
  const clean = wallet.cleanMobile(mobile);
  const u = wallet.findUser(clean);
  if (u && !wallet.checkCanBet(u, clean)) {
    const w = normWhere(where);
    const p = platform === 'android' ? 'android' : 'web';
    const cur = presence.get(clean);
    if (!cur || cur.where !== w) presence.set(clean, { where: w, platform: p, at: now, since: now });
    else { cur.at = now; cur.platform = p; }
    countsCache = null;
    notePeak(rawCounts(now).total, now);
  }
  return publicCounts(now);
}

function leave(mobile) {
  if (presence.delete(wallet.cleanMobile(mobile))) countsCache = null;
  return publicCounts();
}

// ---------- live bets feed ----------
function statusOf(s) {
  if (s === 'won') return 'won';
  if (s === 'lost') return 'lost';
  if (s === 'pending' || s === 'playing') return 'pending';
  return null; // refunded / cancelled: left out
}

function finish(g) {
  const statuses = g.statuses;
  g.status = statuses.has('pending') ? 'pending' : (statuses.has('won') ? 'won' : 'lost');
  g.amount = round2(g.amount);
  g.payout = g.status === 'pending' ? null : round2(g.payout);
  if (g.status === 'won') g.multiplier = g.amount > 0 ? round2(g.payout / g.amount) : null;
  else if (g.status === 'lost') g.multiplier = 0;
  else g.multiplier = g.target || null;
  if (HIDE_PICKS.has(g.game)) g.detail = `${g.picks} pick${g.picks === 1 ? '' : 's'}`;
  delete g.statuses; delete g.target;
  return g;
}

function fromNewBet(b) {
  const st = statusOf(b.status);
  if (!st || !LABELS[b.game]) return null;
  let detail = '';
  if (b.game === 'dice') detail = b.option || '';
  else if (b.game === 'mines') detail = `${b.mines || '?'} mines`;
  else if (b.game === 'jet') detail = st === 'pending' ? '' : (b.option || '');
  return {
    key: `${b.game}|${b.mobile}|${b.created_at}|${b.roundId || b.market || b.id}`,
    id: b.id, game: b.game, gameLabel: LABELS[b.game],
    where: b.game === 'matka99' ? `matka99:${b.market}` : b.game,
    market: b.game === 'matka99' ? (b.marketName || M99_NAME[b.market] || b.market) : null,
    mobile: b.mobile, user: b.user || '',
    amount: Number(b.amount) || 0, payout: Number(b.win_amount) || 0, picks: 1, detail,
    target: b.game === 'dice' || b.game === 'mines' ? b.multiplier : null,
    status: st, at: b.created_at, settledAt: b.settled_at || null
  };
}

function fromMatkaBet(b) {
  const st = statusOf(b.status);
  const market = matkaMarket(b.game_name);
  if (!st || !market) return null;
  const at = b.created_at || b.createdAt;
  const mobile = wallet.cleanMobile(b.mobile);
  return {
    key: `matka|${mobile}|${at}|${market}`,
    id: String(b._id || b.id || ''), game: 'matka', gameLabel: 'Matka',
    where: `matka:${market}`, market,
    mobile, user: b.user || '',
    amount: Number(b.bet_amount || b.amount) || 0, payout: Number(b.win_amount) || 0, picks: 1, detail: '',
    target: null, status: st, at, settledAt: b.settled_at || null
  };
}

function addTo(groups, e) {
  if (!e) return;
  const g = groups.get(e.key);
  if (!g) {
    e.statuses = new Set([e.status]);
    groups.set(e.key, e);
    return;
  }
  g.amount += e.amount;
  g.payout += e.payout;
  g.picks += 1;
  g.statuses.add(e.status);
  if (e.settledAt && (!g.settledAt || ms(e.settledAt) > ms(g.settledAt))) g.settledAt = e.settledAt;
}

let snapshot = null; // { at, all, memo }

function buildSnapshot(now = Date.now()) {
  if (snapshot && now - snapshot.at < FEED_TTL_MS) return snapshot;
  const since = now - LATEST_DAYS * 86400000;
  const groups = new Map();
  const bets = state.bets;
  for (let i = bets.length - 1, n = 0; i >= 0 && n < MAX_SCAN; i--, n++) {
    const b = bets[i];
    if (ms(b.created_at) < since) break; // stored oldest first
    addTo(groups, fromNewBet(b));
  }
  let n = 0;
  for (const b of memoryBets) {
    if (ms(b.created_at || b.createdAt) < since) continue;
    if (++n > MAX_SCAN) break;
    addTo(groups, fromMatkaBet(b));
  }
  const all = [...groups.values()].map(finish).sort((a, b) => ms(b.at) - ms(a.at));
  snapshot = { at: now, all, memo: new Map() };
  return snapshot;
}

function matches(e, game, market) {
  if (!game) return true;
  if (e.game !== game) return false;
  if (!market) return true;
  if (game === 'matka') return e.where === `matka:${matkaMarket(market)}`;
  if (game === 'matka99') return e.where === `matka99:${market}`;
  return true;
}

function publicEntry(e) {
  return {
    id: e.id, game: e.game, gameLabel: e.gameLabel, market: e.market, player: maskMobile(e.mobile),
    amount: e.amount, picks: e.picks, detail: e.detail, status: e.status,
    multiplier: e.multiplier, payout: e.payout, at: e.at
  };
}

function selectFeed(game, market, now) {
  const snap = buildSnapshot(now);
  const memoKey = `${game || ''}|${market || ''}`;
  if (snap.memo.has(memoKey)) return snap.memo.get(memoKey);
  const list = snap.all.filter(e => matches(e, game, market));
  const winsSince = now - WINS_HOURS * 3600000;
  const latest = list.slice(0, 30);
  const bigWins = list
    .filter(e => e.status === 'won' && ms(e.settledAt || e.at) >= winsSince)
    .sort((a, b) => b.payout - a.payout || ms(b.at) - ms(a.at))
    .slice(0, 10);
  const out = { latest, bigWins };
  snap.memo.set(memoKey, out);
  return out;
}

function normFeedArgs(game, market) {
  const g = GAME_KEYS.includes(game) || game === 'matka' || game === 'matka99' ? game : null;
  let m = null;
  if (g === 'matka') m = matkaMarket(market);
  if (g === 'matka99' && M99_NAME[market]) m = market;
  return { g, m };
}

// Public feed. game: a game key, 'matka' or 'matka99' (optional market), or nothing for every game.
function getFeed(game, market, now = Date.now()) {
  if (!cfg().feed) return { feed: false, latest: [], bigWins: [] };
  const { g, m } = normFeedArgs(game, market);
  const { latest, bigWins } = selectFeed(g, m, now);
  return { feed: true, game: g, market: m, latest: latest.map(publicEntry), bigWins: bigWins.map(publicEntry) };
}

// ---------- admin ----------
function getAdminLive(now = Date.now()) {
  const { total, by, platforms } = rawCounts(now);
  const players = [];
  for (const [mobile, p] of presence) {
    if (now - p.at > TTL_MS) continue;
    const u = wallet.findUser(mobile);
    players.push({
      mobile, name: (u && u.name) || '', where: p.where, whereLabel: whereLabel(p.where), platform: p.platform,
      since: new Date(p.since).toISOString(), lastSeen: new Date(p.at).toISOString(),
      balance: u ? wallet.balances(u).balance : null
    });
  }
  players.sort((a, b) => a.whereLabel.localeCompare(b.whereLabel) || ms(a.since) - ms(b.since));

  const places = [{ key: 'lobby', label: whereLabel('lobby'), count: by.lobby || 0 }];
  for (const k of GAME_KEYS) places.push({ key: k, label: LABELS[k], count: by[k] || 0 });
  places.push({ key: 'matka99', label: '99x Matka (all markets)', count: by.matka99 || 0 });
  for (const m of MATKA99_MARKETS) places.push({ key: `matka99:${m.key}`, label: whereLabel(`matka99:${m.key}`), count: by[`matka99:${m.key}`] || 0, sub: true });
  places.push({ key: 'matka', label: 'Matka (all markets)', count: by.matka || 0 });
  for (const m of MATKA_MARKETS) places.push({ key: `matka:${m}`, label: whereLabel(`matka:${m}`), count: by[`matka:${m}`] || 0, sub: true });

  const c = cfg();
  const peaks = Object.entries(state.live.peaks).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7)
    .map(([date, p]) => ({ date, total: p.total, at: p.at }));
  const { latest, bigWins } = selectFeed(null, null, now);
  const adminEntry = e => ({ ...publicEntry(e), mobile: e.mobile, user: e.user });
  return {
    config: { ...c },
    total, platforms, places, players,
    shownToPlayers: publicCounts(now),
    peaks,
    feed: { latest: latest.map(adminEntry), bigWins: bigWins.map(adminEntry) },
    configLog: (state.live.configLog || []).slice(0, 10),
    rules: [
      'A player counts as live while their website or app has pinged in the last 45 seconds.',
      'Each account counts once, in the place it pinged from last.',
      `Players see a number only when it is ${c.minShow} or more; below that they see a green "Live" dot.`,
      'The live bets feed masks mobiles and never shows the picks for lowest-total games.'
    ]
  };
}

class LiveError extends Error { constructor(status, message) { super(message); this.status = status; } }

function updateConfig(body = {}, by = 'admin') {
  const c = cfg();
  const next = { ...c };
  if (body.enabled !== undefined) next.enabled = !!body.enabled;
  if (body.feed !== undefined) next.feed = !!body.feed;
  if (body.minShow !== undefined) {
    const v = Number(body.minShow);
    if (!Number.isInteger(v) || v < 1 || v > 1000) throw new LiveError(400, 'Show-number cut-off must be a whole number from 1 to 1000.');
    next.minShow = v;
  }
  const changes = {};
  for (const k of Object.keys(next)) if (next[k] !== c[k]) changes[k] = { from: c[k], to: next[k] };
  if (Object.keys(changes).length) {
    Object.assign(c, next);
    state.live.configLog = [{ at: new Date().toISOString(), by, changes }, ...(state.live.configLog || [])].slice(0, 50);
    markDirty();
  }
  return { config: { ...c }, changes };
}

function _reset() { presence.clear(); countsCache = null; snapshot = null; }

module.exports = {
  ping, leave, publicCounts, getFeed, getAdminLive, updateConfig, maskMobile, normWhere, whereLabel,
  TTL_MS, GAME_KEYS, MATKA_MARKETS, LiveError, _reset
};
