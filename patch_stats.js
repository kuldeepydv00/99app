const fs = require('fs');
let content = fs.readFileSync('adminController_patched.js', 'utf-8');

const getStatsImpl = `
const getStats = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const User = require('../models/User');
    const Bet = require('../models/Bet');
    const DepositRequest = require('../models/DepositRequest');
    const WithdrawalRequest = require('../models/WithdrawalRequest');

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const usersCount = await User.countDocuments();
    const todayUsers = await User.countDocuments({ createdAt: { $gte: startOfToday } });

    const allDeposits = await DepositRequest.find({ status: 'approved' });
    const todayDeposits = await DepositRequest.find({ status: 'approved', createdAt: { $gte: startOfToday } });
    
    const allWithdrawals = await WithdrawalRequest.find({ status: 'approved' });
    const todayWithdrawals = await WithdrawalRequest.find({ status: 'approved', createdAt: { $gte: startOfToday } });

    const allBets = await Bet.find({});
    const todayBets = await Bet.find({ createdAt: { $gte: startOfToday } });

    const sumAmounts = (arr) => arr.reduce((acc, curr) => acc + (parseFloat(curr.amount || curr.bet_amount) || 0), 0);
    const sumWins = (arr) => arr.reduce((acc, curr) => acc + (parseFloat(curr.win_amount) || 0), 0);

    const totalDeposite = sumAmounts(allDeposits);
    const todayDeposite = sumAmounts(todayDeposits);
    const totalWithdraw = sumAmounts(allWithdrawals);
    const todayWithdraw = sumAmounts(todayWithdrawals);

    const totalBetting = sumAmounts(allBets);
    const todayBetting = sumAmounts(todayBets);

    const totalWinnings = sumWins(allBets);
    const todayWinnings = sumWins(todayBets);

    const users = await User.find({});
    let totalBalanceWallet = 0;
    let totalDepositWallet = 0;
    let totalWinningWallet = 0;
    let totalCommissionWallet = 0;
    let totalBonusWallet = 0;

    users.forEach(u => {
      totalBalanceWallet += parseFloat(u.wallet_balance || 0);
      totalDepositWallet += parseFloat(u.deposit_balance || 0);
      totalWinningWallet += parseFloat(u.winning_balance || 0);
      totalCommissionWallet += parseFloat(u.commission_balance || 0);
      totalBonusWallet += parseFloat(u.bonus_balance !== undefined ? u.bonus_balance : 200);
    });

    res.json({
      success: true,
      users: usersCount,
      dailyNewUsers: todayUsers,
      totalDeposite,
      todayDeposite,
      totalWinnings,
      todayWinnings,
      totalWithdraw,
      todayWithdraw,
      totalBetting,
      todayBetting,
      totalBalanceWallet,
      totalDepositWallet,
      totalWinningWallet,
      totalCommissionWallet,
      totalBonusWallet
    });
  } catch (err) {
    console.error('[GetStats Error]', err);
    res.status(500).json({ success: false });
  }
};
`;

content = content.replace(/const getStats = async \(req, res\) => {[\s\S]*?(?=\n\/\/ @desc\s+Get all users)/, getStatsImpl.trim() + '\n\n');
fs.writeFileSync('adminController_patched.js', content);
console.log('Done replacing getStats');
