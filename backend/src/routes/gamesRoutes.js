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

// Public
router.get('/lobby', c.lobby);
router.get('/trading/:game/state', c.tradingState);
router.get('/matka99/markets', c.matka99Markets);
router.get('/matka99/chart', c.matka99Chart);

// Logged-in player (token must match the mobile acted on)
router.get('/my-bets', protectUser, c.allMyBets);
router.post('/trading/:game/bet', protectUser, gameBetLimiter, c.tradingBet);
router.get('/trading/:game/my-bets', protectUser, c.tradingMyBets);
router.post('/matka99/bet', protectUser, gameBetLimiter, c.matka99Bet);
router.get('/matka99/my-bets', protectUser, c.matka99MyBets);

module.exports = router;
