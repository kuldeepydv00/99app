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
    withBetsOnly: req.query.withBetsOnly === 'true'
  }));
};

exports.tradingBets = (req, res) => {
  if (!validGame(req, res)) return;
  send(res, () => ({ bets: engine.getAdminBets(req.params.game, { roundId: req.query.roundId, mobile: req.query.mobile }) }));
};

exports.tradingConfig = (req, res) => {
  if (!validGame(req, res)) return;
  send(res, () => ({ config: engine.updateConfig(req.params.game, req.body || {}) }));
};

exports.matka99Overview = (req, res) => send(res, () => matka99.getOverview(req.query.date));
exports.matka99Matrix = (req, res) => send(res, () => matka99.getMatrix(req.query.market, req.query.date));
exports.matka99Bets = (req, res) => send(res, () => ({ bets: matka99.getAdminBets(req.query) }));
exports.matka99Chart = (req, res) => send(res, () => matka99.getChart(parseInt(req.query.days, 10) || 90));
exports.matka99Preview = (req, res) => send(res, () => ({ preview: matka99.previewDeclare(req.body.market, req.body.date, req.body.number) }));
exports.matka99Declare = (req, res) => send(res, () => ({ result: matka99.declare(req.body.market, req.body.date, req.body.number, { bypassWindowCheck: !!req.body.bypassWindowCheck }) }));
exports.matka99Toggle = (req, res) => send(res, () => ({ market: matka99.setEnabled(req.body.market, req.body.enabled) }));
exports.matka99Limits = (req, res) => send(res, () => ({ config: matka99.updateLimits(req.body || {}) }));
