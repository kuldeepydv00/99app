// Player-facing endpoints for 99x Matka and Number / Card / Colour Trading.
const engine = require('../games/tradingEngine');
const matka99 = require('../games/matka99');
const jet = require('../games/jetEngine');
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
  matka99: matka99.getMarkets(),
  jet: jet.getLobby()
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
    bets: [...engine.getMyBets('all', mobile, 200), ...matka99.getMyBets(mobile, 200), ...jet.getMyBets(mobile, 200).bets]
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

// ---------- 99x Jet ----------
exports.jetState = (req, res) => send(res, () => jet.getPublicState());

// Live round events (server-sent events): state, round, fly, cashout, bets, blast, paused, config.
exports.jetStream = (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  const write = (type, data) => { res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`); };
  const unsubscribe = jet.subscribe(write);
  if (!unsubscribe) { write('busy', {}); res.end(); return; }
  write('state', jet.getPublicState());
  const ping = setInterval(() => { res.write(': ping\n\n'); }, 15000);
  req.on('close', () => { clearInterval(ping); unsubscribe(); });
};

exports.jetRound = (req, res) => send(res, () => ({ round: jet.getRoundProof(req.params.id) }));

exports.jetMyBets = (req, res) => {
  const mobile = ownMobile(req, res, req.query.mobile);
  if (!mobile) return;
  send(res, () => jet.getMyBets(mobile));
};

exports.jetBet = (req, res) => {
  const mobile = ownMobile(req, res, req.body.mobile);
  if (!mobile) return;
  send(res, () => jet.placeBet(mobile, req.body));
};

exports.jetCancel = (req, res) => {
  const mobile = ownMobile(req, res, req.body.mobile);
  if (!mobile) return;
  send(res, () => jet.cancelBet(mobile, req.body));
};

exports.jetCashout = (req, res) => {
  const mobile = ownMobile(req, res, req.body.mobile);
  if (!mobile) return;
  send(res, () => jet.cashOut(mobile, req.body));
};
