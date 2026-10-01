const express = require('express');
const router = express.Router();
const { protectUser } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const c = require('../controllers/gamesController');

// Colour rounds are 60 seconds long, so bet limits here are looser than the wallet endpoints.
const gameBetLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 120,
  message: 'Too many bets too quickly. Please wait a moment and try again.'
});

// 99x Jet rounds are about 27 seconds long: up to 2 bets per round plus cancels and cash-outs.
const jetBetLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 300,
  message: 'Too many bets too quickly. Please wait a moment and try again.'
});
const jetCashoutLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 400,
  message: 'Too many requests. Please wait a moment and try again.'
});

// Public
router.get('/lobby', c.lobby);
router.get('/jet/state', c.jetState);
router.get('/jet/stream', c.jetStream);
router.get('/jet/round/:id', c.jetRound);
router.get('/trading/:game/state', c.tradingState);
router.get('/matka99/markets', c.matka99Markets);
router.get('/matka99/chart', c.matka99Chart);

// Logged-in player (token must match the mobile acted on)
router.get('/my-bets', protectUser, c.allMyBets);
router.post('/trading/:game/bet', protectUser, gameBetLimiter, c.tradingBet);
router.get('/trading/:game/my-bets', protectUser, c.tradingMyBets);
router.post('/matka99/bet', protectUser, gameBetLimiter, c.matka99Bet);
router.get('/matka99/my-bets', protectUser, c.matka99MyBets);
router.get('/jet/my-bets', protectUser, c.jetMyBets);
router.post('/jet/bet', protectUser, jetBetLimiter, c.jetBet);
router.post('/jet/cancel', protectUser, jetBetLimiter, c.jetCancel);
router.post('/jet/cashout', protectUser, jetCashoutLimiter, c.jetCashout);

module.exports = router;
