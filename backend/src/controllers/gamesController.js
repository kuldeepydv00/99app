// Player-facing endpoints for 99x Matka and Number / Card / Colour Trading.
const engine = require('../games/tradingEngine');
const matka99 = require('../games/matka99');
const { cleanMobile } = require('../games/wallet');

const send = (res, fn) => {
  try {
    return res.json({ success: true, ...fn() });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[Games API]', err);
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

// The caller's token must belong to the mobile number the request acts on.
const ownMobile = (req, res, mobile) => {
  const clean = cleanMobile(mobile);
  if (!req.authMobile || req.authMobile !== clean) {
    res.status(403).json({ success: false, message: 'You can only bet from your own account' });
    return null;
  }
  return clean;
};

exports.lobby = (req, res) => send(res, () => ({
  ...engine.getLobby(),
  matka99: matka99.getMarkets()
}));

exports.tradingState = (req, res) => {
  if (!validGame(req, res)) return;
  send(res, () => engine.getPublicState(req.params.game));
};

exports.tradingBet = (req, res) => {
  if (!validGame(req, res)) return;
  const mobile = ownMobile(req, res, req.body.mobile);
  if (!mobile) return;
  send(res, () => engine.placeBets(req.params.game, mobile, req.body.bets));
};

exports.tradingMyBets = (req, res) => {
  if (!validGame(req, res)) return;
  const mobile = ownMobile(req, res, req.query.mobile);
  if (!mobile) return;
  send(res, () => ({ bets: engine.getMyBets(req.params.game, mobile) }));
};

exports.allMyBets = (req, res) => {
  const mobile = ownMobile(req, res, req.query.mobile);
  if (!mobile) return;
  send(res, () => ({
    bets: [...engine.getMyBets('all', mobile, 200), ...matka99.getMyBets(mobile, 200)]
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 300)
  }));
};

exports.matka99Markets = (req, res) => send(res, () => matka99.getMarkets());

exports.matka99Bet = (req, res) => {
  const mobile = ownMobile(req, res, req.body.mobile);
  if (!mobile) return;
  send(res, () => matka99.placeBets(mobile, req.body.market, req.body.bets));
};

exports.matka99MyBets = (req, res) => {
  const mobile = ownMobile(req, res, req.query.mobile);
  if (!mobile) return;
  send(res, () => ({ bets: matka99.getMyBets(mobile) }));
};

exports.matka99Chart = (req, res) => send(res, () => matka99.getChart(parseInt(req.query.days, 10) || 60));
