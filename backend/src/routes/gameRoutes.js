const express = require('express');
const router = express.Router();
const { protectUser } = require('../middleware/auth');
const { placeBet, getMyBets, getResults, getChartResults } = require('../controllers/gameController');
const { getGameSchedules, getBannerConfig, getBannersList, getLivePlayers } = require('../controllers/adminController');

router.get('/results', getResults);
router.get('/chart-results', getChartResults);
router.get('/schedules', getGameSchedules);
router.get('/banner', getBannerConfig);
router.get('/banners', getBannersList);
// (POST /banner removed: it let anyone change the home banner. Admin uses /api/admin/update-banner.)
router.get('/live-players', getLivePlayers);
// Matka bets and bet history: caller's token must match the mobile number used
router.post('/bet', protectUser, placeBet);
router.get('/my-bets', protectUser, getMyBets);

module.exports = router;
