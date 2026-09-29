// Cross-game reporting for the admin panel: one place that knows how to total
// 99x Matka and the three trading games for a date range, a user, or the dashboard.
const { state } = require('./gamesStore');
const wallet = require('./wallet');
const engine = require('./tradingEngine');
const matka99 = require('./matka99');
const { getISTDateStr } = require('../utils/dateCycle');

const GAME_KEYS = ['matka99', 'number', 'card', 'colour'];
const LABELS = { matka99: '99x Matka', number: 'Number Trading', card: 'Card Trading', colour: 'Colour Trading' };

// The business date of a bet: 99x Matka uses its market date, trading uses the IST day it was placed.
const betDate = b => (b.game === 'matka99' ? b.dateKey : engine.istDateOf(b.created_at));

const isoOk = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
function range(from, to) {
  const today = getISTDateStr(new Date());
  let a = isoOk(from) ? from : today;
  let b = isoOk(to) ? to : a;
  if (a > b) [a, b] = [b, a];
  return { from: a, to: b };
}

function emptyAgg() { return { bets: 0, players: new Set(), staked: 0, paid: 0, refunded: 0, pending: 0, pendingAmount: 0, wins: 0 }; }
function addBet(agg, b) {
  if (b.status === 'refunded') { agg.refunded += b.amount; return; }
  agg.bets += 1; agg.players.add(b.mobile); agg.staked += b.amount;
  if (b.status === 'won') { agg.paid += b.win_amount || 0; agg.wins += 1; }
  if (b.status === 'pending') { agg.pending += 1; agg.pendingAmount += b.amount; }
}
function finish(agg) {
  return {
    bets: agg.bets, players: agg.players.size, staked: wallet.round2(agg.staked), paid: wallet.round2(agg.paid),
    net: wallet.round2(agg.staked - agg.paid), refunded: wallet.round2(agg.refunded),
    pending: agg.pending, pendingAmount: wallet.round2(agg.pendingAmount), wins: agg.wins
  };
}

function dayList(from, to) {
  const out = [];
  let t = new Date(from + 'T12:00:00Z').getTime();
  const end = new Date(to + 'T12:00:00Z').getTime();
  while (t <= end && out.length < 93) {
    out.push(new Date(t).toISOString().slice(0, 10));
    t += 86400000;
  }
  return out;
}

// Totals per game and overall for [from, to] (IST dates, inclusive), plus a daily series,
// the biggest wins, and 99x markets whose result is overdue.
function summary({ from, to } = {}) {
  const r = range(from, to);
  const per = {}; GAME_KEYS.forEach(g => { per[g] = emptyAgg(); });
  const total = emptyAgg();
  const days = dayList(r.from, r.to);
  const daily = {}; days.forEach(d => { daily[d] = { date: d }; GAME_KEYS.forEach(g => { daily[d][g] = { staked: 0, paid: 0 }; }); });
  const wins = [];

  for (const b of state.bets) {
    if (!per[b.game]) continue;
    const d = betDate(b);
    if (!d || d < r.from || d > r.to) continue;
    addBet(per[b.game], b); addBet(total, b);
    if (daily[d] && b.status !== 'refunded') {
      daily[d][b.game].staked += b.amount;
      daily[d][b.game].paid += b.win_amount || 0;
    }
    if (b.status === 'won') wins.push(b);
  }

  wins.sort((a, b) => (b.win_amount || 0) - (a.win_amount || 0));
  const games = {};
  GAME_KEYS.forEach(g => {
    games[g] = { key: g, label: LABELS[g], ...finish(per[g]) };
    if (g !== 'matka99') {
      const cfg = state.config[g] || {};
      games[g].enabled = cfg.enabled !== false; games[g].payout = cfg.payout;
    } else {
      games[g].payout = matka99.FIXED_PAYOUT;
      const { MATKA99_MARKETS } = require('./gamesStore');
      games[g].enabledMarkets = MATKA99_MARKETS.filter(m => state.matka99.enabled[m.key] !== false).length;
      games[g].enabled = games[g].enabledMarkets > 0;
    }
  });

  // 99x markets that closed with pending bets but no result yet (today and the last 7 days)
  const awaiting = [];
  const today = getISTDateStr(new Date());
  for (let i = 0; i < 8; i++) {
    const d = getISTDateStr(new Date(Date.now() - i * 86400000));
    const ov = matka99.getOverview(d);
    ov.markets.filter(m => m.awaitingResult).forEach(m => awaiting.push({
      key: m.key, name: m.name, date: d, bets: m.pendingBets, staked: m.staked, resultTime: m.resultTime, isToday: d === today
    }));
  }

  return {
    from: r.from, to: r.to,
    total: finish(total),
    games,
    daily: days.map(d => {
      const row = { date: d, staked: 0, paid: 0, net: 0 };
      GAME_KEYS.forEach(g => {
        row[g] = { staked: wallet.round2(daily[d][g].staked), paid: wallet.round2(daily[d][g].paid) };
        row.staked += daily[d][g].staked; row.paid += daily[d][g].paid;
      });
      row.staked = wallet.round2(row.staked); row.paid = wallet.round2(row.paid); row.net = wallet.round2(row.staked - row.paid);
      return row;
    }),
    topWins: wins.slice(0, 10).map(b => ({
      id: b.id, game: b.game, label: LABELS[b.game], market: b.marketName || null, roundId: b.roundId || null,
      user: b.user, mobile: b.mobile, option: b.option, amount: b.amount, win_amount: b.win_amount, at: b.settled_at || b.created_at
    })),
    awaitingResults: awaiting
  };
}

// Every new-game bet for one player, newest first, with totals per game.
function userBets(mobile, { limit = 300, game } = {}) {
  const clean = wallet.cleanMobile(mobile);
  const per = {}; GAME_KEYS.forEach(g => { per[g] = emptyAgg(); });
  const all = emptyAgg();
  const list = [];
  for (const b of state.bets) {
    if (b.mobile !== clean || !per[b.game]) continue;
    addBet(per[b.game], b); addBet(all, b);
    if (!game || game === b.game) list.push(b);
  }
  list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const games = {}; GAME_KEYS.forEach(g => { games[g] = { key: g, label: LABELS[g], ...finish(per[g]) }; });
  return {
    mobile: clean, total: finish(all), games,
    bets: list.slice(0, limit).map(b => ({ ...b, label: LABELS[b.game], date: betDate(b) }))
  };
}

// Numbers the main dashboard adds to its own: [from, to] range and all-time.
function dashboardTotals(fromIso, toIso) {
  const rng = emptyAgg(), all = emptyAgg();
  const per = {}; GAME_KEYS.forEach(g => { per[g] = emptyAgg(); });
  for (const b of state.bets) {
    if (!per[b.game]) continue;
    addBet(all, b);
    const d = betDate(b);
    if (d && d >= fromIso && d <= toIso) { addBet(rng, b); addBet(per[b.game], b); }
  }
  const byGame = {}; GAME_KEYS.forEach(g => { byGame[g] = { label: LABELS[g], ...finish(per[g]) }; });
  return { range: finish(rng), allTime: finish(all), byGame };
}

// Won / refunded / reversed events for the admin ledgers.
function ledgerEventsFor(mobile) {
  const clean = wallet.cleanMobile(mobile);
  return state.bets.filter(b => b.mobile === clean && LABELS[b.game]);
}

module.exports = { GAME_KEYS, LABELS, betDate, summary, userBets, dashboardTotals, ledgerEventsFor };
