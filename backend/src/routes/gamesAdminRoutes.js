const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/auth');
const c = require('../controllers/gamesAdminController');

router.use(protectAdmin);

router.get('/trading/:game/overview', c.tradingOverview);
router.get('/trading/:game/rounds', c.tradingRounds);
router.get('/trading/:game/bets', c.tradingBets);
router.post('/trading/:game/config', c.tradingConfig);
router.post('/trading/:game/cancel-round', c.tradingCancelRound);
router.get('/trading/:game/report', c.tradingReport);

router.get('/matka99/overview', c.matka99Overview);
router.get('/matka99/matrix', c.matka99Matrix);
router.get('/matka99/bets', c.matka99Bets);
router.get('/matka99/chart', c.matka99Chart);
router.post('/matka99/preview', c.matka99Preview);
router.post('/matka99/declare', c.matka99Declare);
router.post('/matka99/toggle', c.matka99Toggle);
router.post('/matka99/limits', c.matka99Limits);
router.post('/matka99/undo', c.matka99Undo);
router.post('/matka99/refund', c.matka99Refund);
router.get('/matka99/report', c.matka99Report);

router.get('/jet/overview', c.jetOverview);
router.get('/jet/rounds', c.jetRounds);
router.get('/jet/bets', c.jetBets);
router.get('/jet/report', c.jetReport);
router.post('/jet/config', c.jetConfig);

router.get('/summary', c.summary);
router.get('/user/:mobile/bets', c.userBets);

module.exports = router;
