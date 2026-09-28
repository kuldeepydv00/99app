const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/auth');
const c = require('../controllers/gamesAdminController');

router.use(protectAdmin);

router.get('/trading/:game/overview', c.tradingOverview);
router.get('/trading/:game/rounds', c.tradingRounds);
router.get('/trading/:game/bets', c.tradingBets);
router.post('/trading/:game/config', c.tradingConfig);

router.get('/matka99/overview', c.matka99Overview);
router.get('/matka99/matrix', c.matka99Matrix);
router.get('/matka99/bets', c.matka99Bets);
router.get('/matka99/chart', c.matka99Chart);
router.post('/matka99/preview', c.matka99Preview);
router.post('/matka99/declare', c.matka99Declare);
router.post('/matka99/toggle', c.matka99Toggle);
router.post('/matka99/limits', c.matka99Limits);

module.exports = router;
