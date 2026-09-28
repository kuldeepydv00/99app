const express = require('express');
const router = express.Router();
const { protectUser } = require('../middleware/auth');
const { authLimiter, moneyLimiter } = require('../middleware/rateLimit');
const { 
  registerUser, 
  loginUser, 
  getUserProfile, 
  getWalletBalance, 
  updateWalletBalance, 
  getTransactions, 
  submitDeposit,
  requestWithdrawal,
  saveBankDetails,
  getBankDetails,
  sendSmsOtp,
  verifySmsOtp,
  resendSmsOtp,
  checkUserExists,
  getReferralDetails,
  applyReferralCode,
  transferCommissionToWallet,
  uploadApkChunk
} = require('../controllers/userController');

// Public: no account exists yet / proving phone ownership happens here
router.post('/upload-apk-chunk', uploadApkChunk);
router.get('/check', checkUserExists);
router.get('/referral-details', getReferralDetails);
router.post('/apply-referral', applyReferralCode);
router.post('/register', registerUser);
router.post('/login', authLimiter, loginUser);
router.post('/send-otp', authLimiter, sendSmsOtp);
router.post('/verify-otp', authLimiter, verifySmsOtp);
router.post('/resend-otp', authLimiter, resendSmsOtp);

// Protected: caller must hold a valid token for the account these act on
// (verified again per-request inside each controller against req.authMobile)
router.get('/profile', protectUser, getUserProfile);
router.get('/wallet/balance', protectUser, getWalletBalance);
router.post('/wallet/balance', protectUser, updateWalletBalance);
router.get('/wallet/transactions', protectUser, getTransactions);
router.post('/deposit', protectUser, moneyLimiter, submitDeposit);
router.post('/deposit/request', protectUser, moneyLimiter, submitDeposit);
router.post('/withdraw/request', protectUser, moneyLimiter, requestWithdrawal);
router.get('/bank-details', protectUser, getBankDetails);
router.post('/bank-details/save', protectUser, saveBankDetails);
router.post('/commission/transfer', protectUser, transferCommissionToWallet);

module.exports = router;
