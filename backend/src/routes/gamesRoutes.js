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

// Dice is one request per bet and Mines one per tile, so these allow more requests.
const instantLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 1500,
  message: 'Too many bets too quickly. Please wait a moment and try again.'
});

// Live players ping every ~15 s; many players can share one IP (mobile networks), so this is loose.
const livePingLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 3000,
  message: 'Too many requests. Please wait a moment and try again.'
});

// Public
router.get('/live', c.liveCounts);
router.get('/live/feed', c.liveFeed);
router.get('/lobby', c.lobby);
router.get('/instant/:game/state', c.instantState);
router.post('/fairness/verify', instantLimiter, c.fairnessVerify);
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
router.get('/instant/my-bets', protectUser, c.instantMyBets);
router.post('/dice/bet', protectUser, instantLimiter, c.diceBet);
router.get('/mines/active', protectUser, c.minesActive);
router.post('/mines/start', protectUser, instantLimiter, c.minesStart);
router.post('/mines/reveal', protectUser, instantLimiter, c.minesReveal);
router.post('/mines/cashout', protectUser, instantLimiter, c.minesCashout);
router.get('/fairness', protectUser, c.fairness);
router.post('/fairness/rotate', protectUser, c.fairnessRotate);
router.post('/live/ping', protectUser, livePingLimiter, c.livePing);
router.post('/live/leave', protectUser, livePingLimiter, c.liveLeave);

module.exports = router;
