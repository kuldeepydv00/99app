const express = require('express');
const router = express.Router();
const { protectUser } = require('../middleware/auth');
const { placeBet, getMyBets, getResults, getChartResults } = require('../controllers/gameController');
const { getGameSchedules, getLivePlayers } = require('../controllers/adminController');
// The website's banners: light versions (images by address, not inside the data; see publicContent.js)
const { publicBanners, publicBannerConfig, promoImage } = require('../controllers/publicContent');

router.get('/results', getResults);
router.get('/chart-results', getChartResults);
router.get('/schedules', getGameSchedules);
router.get('/banner', publicBannerConfig);
router.get('/banners', publicBanners);
router.get('/promo-image/:v', promoImage);
// (POST /banner removed: it let anyone change the home banner. Admin uses /api/admin/update-banner.)
router.get('/live-players', getLivePlayers);
// Matka bets and bet history: caller's token must match the mobile number used
router.post('/bet', protectUser, placeBet);
router.get('/my-bets', protectUser, getMyBets);

module.exports = router;
