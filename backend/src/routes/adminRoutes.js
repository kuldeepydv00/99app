const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/auth');
const { authLimiter, moneyLimiter } = require('../middleware/rateLimit');
const {
  getStats,
  getUsers,
  getBetMatrix,
  getAdminBets,
  updateAdminBid,
  getGameSchedules,
  updateGameSchedule,
  toggleMarketStatus,
  getDeposits,
  createDepositRequest,
  approveDeposit,
  rejectDeposit,
  getWithdrawals,
  createWithdrawalRequest,
  approveWithdrawal,
  rejectWithdrawal,
  declareGameResult,
  clearGameResult,
  editGameResult,
  getResultsHistory,
  getDeclaredResults,
  updateUserWallet,
  getBannerConfig,
  updateBannerConfig,
  getBannersList,
  saveBannersList,
  getAppVersionConfig,
  updateAppVersionConfig,
  getSettingsConfig,
  updateSettingsConfig,
  getReferralConfig,
  updateReferralConfig,
  getReferralStats,
  adminLogin,
  verifyAdminOtp,
  getAdminAdmins,
  getAdminWinnings,
  getGameLedger,
  getCommissionLogs,
  getLeaderboard,
  getPayouts,
  getPackages,
  getPaymentMethods,
  savePaymentMethod,
  deletePaymentMethod,
  toggleActivePaymentMethod,
  sendCustomNotification,
  getNotifications,
  deleteNotification,
  deleteUser,
  deleteAdminBid,
  blockUser,
  unblockUser,
  updateUser,
  getLivePlayers,
  updateLivePlayers,
  updateAutoPlayerConfig
} = require('../controllers/adminController');

// Auth endpoints: must stay public, this is how an admin session begins
router.post('/login', authLimiter, adminLogin);
router.post('/verify-otp', authLimiter, verifyAdminOtp);

// Public read-only endpoints the live website/Android app call directly (unauthenticated
// end users, not admins) — these must stay open or the public app breaks.
router.get('/schedules', getGameSchedules);
router.get('/declared-results', getDeclaredResults);
router.get('/payment-methods', getPaymentMethods);
router.get('/paymentMethods', getPaymentMethods);

// Everything else below is admin-only: every route requires a valid admin session token.
router.use(protectAdmin);

router.get('/notifications', getNotifications);
router.post('/send-notification', sendCustomNotification);
router.delete('/notifications/:id', deleteNotification);

router.get('/admins', getAdminAdmins);
router.get('/winnings', getAdminWinnings);
router.get('/game-ledger', getGameLedger);
router.get('/commission-logs', getCommissionLogs);
router.get('/leaderboard', getLeaderboard);
router.get('/payouts', getPayouts);
router.get('/packages', getPackages);
router.post('/payment-methods', savePaymentMethod);
router.post('/payment-methods/save', savePaymentMethod);
router.delete('/payment-methods/:id', deletePaymentMethod);
router.post('/payment-methods/:id/toggle', toggleActivePaymentMethod);

router.post('/paymentMethods', savePaymentMethod);
router.delete('/paymentMethods/:id', deletePaymentMethod);
router.post('/paymentMethods/:id/toggle', toggleActivePaymentMethod);

router.get('/banner', getBannerConfig);
router.post('/update-banner', updateBannerConfig);
router.get('/banners', getBannersList);
router.post('/update-banners-list', saveBannersList);
router.get('/app-version', getAppVersionConfig);
router.post('/update-app-version', updateAppVersionConfig);
router.get('/settings', getSettingsConfig);
router.post('/update-settings', updateSettingsConfig);
router.get('/referral-config', getReferralConfig);
router.post('/update-referral-config', updateReferralConfig);
router.get('/referral-stats', getReferralStats);
router.get('/stats', getStats);
router.get('/users', getUsers);
router.post('/users/update', updateUser);
router.post('/users/edit', updateUser);
router.delete('/users/:id', deleteUser);
router.post('/users/:id/delete', deleteUser);
router.post('/users/block', blockUser);
router.post('/users/unblock', unblockUser);
router.get('/matrix', getBetMatrix);
router.get('/bets', getAdminBets);
router.get('/bids', getAdminBets);
router.delete('/bets/:id', deleteAdminBid);
router.delete('/bids/:id', deleteAdminBid);
router.post('/update-bid', updateAdminBid);
router.post('/update-schedule', updateGameSchedule);
router.post('/toggle-market-status', toggleMarketStatus);
router.post('/update-user-wallet', updateUserWallet);
router.post('/declare-result', declareGameResult);
router.post('/clear-result', clearGameResult);
router.post('/edit-result', editGameResult);
router.get('/results-history', getResultsHistory);

// Deposits routes
router.get('/deposits', getDeposits);
router.post('/deposits/request', createDepositRequest);
router.post('/deposits/:id/approve', moneyLimiter, approveDeposit);
router.post('/deposits/:id/reject', moneyLimiter, rejectDeposit);

// Withdrawals routes
router.get('/withdrawals', getWithdrawals);
router.post('/withdrawals/request', createWithdrawalRequest);
router.post('/withdrawals/:id/approve', moneyLimiter, approveWithdrawal);
router.post('/withdrawals/:id/reject', moneyLimiter, rejectWithdrawal);

// Live Players count (User Change feature)
router.get('/live-players', getLivePlayers);
router.post('/live-players', updateLivePlayers);
router.post('/live-players/auto-config', updateAutoPlayerConfig);

module.exports = router;
