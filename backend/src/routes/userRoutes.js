const express = require('express');
const router = express.Router();
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

router.post('/upload-apk-chunk', uploadApkChunk);
router.get('/check', checkUserExists);
router.get('/referral-details', getReferralDetails);
router.post('/apply-referral', applyReferralCode);
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/send-otp', sendSmsOtp);
router.post('/verify-otp', verifySmsOtp);
router.post('/resend-otp', resendSmsOtp);
router.get('/profile', getUserProfile);
router.get('/wallet/balance', getWalletBalance);
router.post('/wallet/balance', updateWalletBalance);
router.get('/wallet/transactions', getTransactions);
router.post('/deposit', submitDeposit);
router.post('/deposit/request', submitDeposit);
router.post('/withdraw/request', requestWithdrawal);
router.get('/bank-details', getBankDetails);
router.post('/bank-details/save', saveBankDetails);
router.post('/commission/transfer', transferCommissionToWallet);

module.exports = router;
