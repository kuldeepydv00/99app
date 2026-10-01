// Admin endpoints for 99x Matka and the trading games. Mounted behind protectAdmin.
const engine = require('../games/tradingEngine');
const matka99 = require('../games/matka99');

const send = (res, fn) => {
  try {
    return res.json({ success: true, ...fn() });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[Games Admin API]', err);
    return res.status(status).json({ success: false, message: err.message || 'Something went wrong' });
  }
};

const validGame = (req, res) => {
  if (!engine.GAMES[req.params.game]) {
    res.status(404).json({ success: false, message: 'Unknown game' });
    return false;
  }
  return true;
};

exports.tradingOverview = (req, res) => {
  if (!validGame(req, res)) return;
  send(res, () => engine.getAdminOverview(req.params.game));
};

exports.tradingRounds = (req, res) => {
  if (!validGame(req, res)) return;
  send(res, () => engine.getAdminRounds(req.params.game, {
    limit: Math.min(parseInt(req.query.limit, 10) || 50, 500),
    offset: parseInt(req.query.offset, 10) || 0,
    withBetsOnly: req.query.withBetsOnly === 'true',
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || '')) ? req.query.date : null
  }));
};

exports.tradingBets = (req, res) => {
  if (!validGame(req, res)) return;
  send(res, () => ({ bets: engine.getAdminBets(req.params.game, {
    roundId: req.query.roundId, mobile: req.query.mobile, status: req.query.status, date: req.query.date,
    limit: Math.min(parseInt(req.query.limit, 10) || 500, 5000)
  }) }));
};

exports.tradingCancelRound = (req, res) => {
  if (!validGame(req, res)) return;
  send(res, () => ({ cancelled: engine.cancelRound(req.params.game, String((req.body || {}).roundId || ''), (req.body || {}).reason) }));
};

exports.tradingReport = (req, res) => {
  if (!validGame(req, res)) return;
  send(res, () => ({ days: engine.getDailyReport(req.params.game, Math.min(parseInt(req.query.days, 10) || 14, 60)) }));
};

exports.tradingConfig = (req, res) => {
  if (!validGame(req, res)) return;
  send(res, () => ({ config: engine.updateConfig(req.params.game, req.body || {}) }));
};

exports.matka99Overview = (req, res) => send(res, () => matka99.getOverview(req.query.date));
exports.matka99Matrix = (req, res) => send(res, () => matka99.getMatrix(req.query.market, req.query.date));
exports.matka99Bets = (req, res) => send(res, () => ({ bets: matka99.getAdminBets({ ...req.query, limit: Math.min(parseInt(req.query.limit, 10) || 500, 5000) }) }));
exports.matka99Chart = (req, res) => send(res, () => matka99.getChart(parseInt(req.query.days, 10) || 90));
exports.matka99Preview = (req, res) => send(res, () => ({ preview: matka99.previewDeclare(req.body.market, req.body.date, req.body.number) }));
// 99x results are declared automatically (lowest total bet wins), so they can't be picked or undone by hand.
const AUTO_ONLY = 'Results for 99x Matka are declared automatically at each market’s result time (lowest total bet wins).';
exports.matka99Declare = (req, res) => res.status(400).json({ success: false, message: AUTO_ONLY });
exports.matka99Toggle = (req, res) => send(res, () => ({ market: matka99.setEnabled(req.body.market, req.body.enabled) }));
exports.matka99Limits = (req, res) => send(res, () => ({ config: matka99.updateLimits(req.body || {}) }));
exports.matka99Undo = (req, res) => res.status(400).json({ success: false, message: `${AUTO_ONLY} They can’t be undone.` });
exports.matka99Refund = (req, res) => send(res, () => ({ refunded: matka99.refundMarket((req.body || {}).market, (req.body || {}).date, (req.body || {}).reason) }));
exports.matka99Report = (req, res) => send(res, () => ({ days: matka99.getDailyReport(Math.min(parseInt(req.query.days, 10) || 14, 60)) }));

// Cross-game
const report = require('../games/gamesReport');
exports.summary = (req, res) => send(res, () => report.summary({ from: req.query.from, to: req.query.to }));
exports.userBets = (req, res) => send(res, () => report.userBets(req.params.mobile, {
  game: report.GAME_KEYS.includes(req.query.game) ? req.query.game : undefined,
  limit: Math.min(parseInt(req.query.limit, 10) || 300, 2000)
}));

// ---------- 99x Jet ----------
const jet = require('../games/jetEngine');
const dateParam = q => (/^\d{4}-\d{2}-\d{2}$/.test(String(q || '')) ? q : null);
exports.jetOverview = (req, res) => send(res, () => jet.getAdminOverview(req.query.date));
exports.jetRounds = (req, res) => send(res, () => jet.getAdminRounds({
  date: dateParam(req.query.date),
  limit: Math.min(parseInt(req.query.limit, 10) || 100, 2000),
  offset: parseInt(req.query.offset, 10) || 0,
  withBetsOnly: req.query.withBetsOnly === 'true'
}));
exports.jetBets = (req, res) => send(res, () => ({ bets: jet.getAdminBets({
  roundId: req.query.roundId, mobile: req.query.mobile, status: req.query.status, date: dateParam(req.query.date),
  limit: Math.min(parseInt(req.query.limit, 10) || 500, 5000)
}) }));
exports.jetReport = (req, res) => send(res, () => ({ days: jet.getDailyReport(Math.min(parseInt(req.query.days, 10) || 14, 60)) }));
exports.jetConfig = (req, res) => send(res, () => jet.updateConfig(req.body || {}, 'admin'));
