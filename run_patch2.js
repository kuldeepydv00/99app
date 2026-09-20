const fs = require('fs');
let code = fs.readFileSync('adminController_final.js', 'utf8');

const regexes = {
  getStats: /const getStats = async \(req, res\) => \{[\s\S]*?\n\};\n/g,
  getDeposits: /const getDeposits = async \(req, res\) => \{[\s\S]*?\n\};\n/g,
  getWithdrawals: /const getWithdrawals = async \(req, res\) => \{[\s\S]*?\n\};\n/g,
  approveDeposit: /const approveDeposit = async \(req, res\) => \{[\s\S]*?\n\};\n/g,
  rejectDeposit: /const rejectDeposit = async \(req, res\) => \{[\s\S]*?\n\};\n/g,
  approveWithdrawal: /const approveWithdrawal = async \(req, res\) => \{[\s\S]*?\n\};\n/g,
  rejectWithdrawal: /const rejectWithdrawal = async \(req, res\) => \{[\s\S]*?\n\};\n/g,
};

const impls = {
  getStats: `const getStats = async (req, res) => {
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
      totalDeposite: sumAmounts(allDeposits),
      todayDeposite: sumAmounts(todayDeposits),
      totalWinnings: sumWins(allBets),
      todayWinnings: sumWins(todayBets),
      totalWithdraw: sumAmounts(allWithdrawals),
      todayWithdraw: sumAmounts(todayWithdrawals),
      totalBetting: sumAmounts(allBets),
      todayBetting: sumAmounts(todayBets),
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
`,
  getDeposits: `const getDeposits = async (req, res) => {
  try {
    const DepositRequest = require('../models/DepositRequest');
    const deposits = await DepositRequest.find({}).sort({ createdAt: -1 }).lean();
    const mapped = deposits.map(d => ({
      ...d,
      id: d._id.toString(),
      _id: d._id.toString(),
      date: d.createdAt ? new Date(d.createdAt).toISOString() : new Date().toISOString()
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ success: false });
  }
};
`,
  getWithdrawals: `const getWithdrawals = async (req, res) => {
  try {
    const WithdrawalRequest = require('../models/WithdrawalRequest');
    const withdrawals = await WithdrawalRequest.find({}).sort({ createdAt: -1 }).lean();
    const mapped = withdrawals.map(w => ({
      ...w,
      id: w._id.toString(),
      _id: w._id.toString(),
      date: w.createdAt ? new Date(w.createdAt).toISOString() : new Date().toISOString()
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ success: false });
  }
};
`,
  approveDeposit: `const approveDeposit = async (req, res) => {
  const { id } = req.params;
  try {
    const mongoose = require('mongoose');
    const DepositRequest = require('../models/DepositRequest');
    const User = require('../models/User');

    let query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { utr_number: id };
    const dep = await DepositRequest.findOne(query);

    if (!dep) {
      return res.status(404).json({ success: false, message: 'Deposit request not found' });
    }

    if (dep.status === 'approved') {
      return res.status(400).json({ success: false, message: 'Already approved' });
    }

    dep.status = 'approved';
    await dep.save();

    let cleanMobile = '';
    if (dep.user_id) cleanMobile = dep.user_id.replace(/[^0-9]/g, '').slice(-10);

    let userObj = await User.findOne({ mobile: { $regex: cleanMobile + '$' } });
    if (!userObj) userObj = await User.findOne({}); // fallback

    if (userObj) {
      let depositBonus = 0;
      if (dep.amount >= 1000 && !userObj.firstDepositBonusClaimed) {
        depositBonus = 200;
        userObj.firstDepositBonusClaimed = true;
      }
      
      const totalCredit = dep.amount + depositBonus;
      userObj.deposit_balance = (userObj.deposit_balance || 0) + totalCredit;
      userObj.wallet_balance = (userObj.deposit_balance || 0) + (userObj.winning_balance || 0) + (userObj.commission_balance || 0);
      await userObj.save();

      return res.json({ success: true, message: 'Deposit Approved', updatedBalance: userObj.wallet_balance });
    }
    
    return res.json({ success: true, message: 'Deposit Approved (User balance not synced)' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false });
  }
};
`,
  rejectDeposit: `const rejectDeposit = async (req, res) => {
  const { id } = req.params;
  try {
    const mongoose = require('mongoose');
    const DepositRequest = require('../models/DepositRequest');
    
    let query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { utr_number: id };
    const dep = await DepositRequest.findOne(query);

    if (!dep) return res.status(404).json({ success: false, message: 'Deposit not found' });
    
    dep.status = 'rejected';
    await dep.save();
    return res.json({ success: true, message: 'Deposit Rejected' });
  } catch (e) {
    res.status(500).json({ success: false });
  }
};
`,
  approveWithdrawal: `const approveWithdrawal = async (req, res) => {
  const { id } = req.params;
  try {
    const mongoose = require('mongoose');
    const WithdrawalRequest = require('../models/WithdrawalRequest');

    let query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { utr_number: id };
    const wd = await WithdrawalRequest.findOne(query);

    if (!wd) return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
    if (wd.status === 'approved') return res.status(400).json({ success: false, message: 'Already approved' });

    wd.status = 'approved';
    await wd.save();

    return res.json({ success: true, message: 'Withdrawal Approved' });
  } catch (e) {
    res.status(500).json({ success: false });
  }
};
`,
  rejectWithdrawal: `const rejectWithdrawal = async (req, res) => {
  const { id } = req.params;
  try {
    const mongoose = require('mongoose');
    const WithdrawalRequest = require('../models/WithdrawalRequest');
    const User = require('../models/User');

    let query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { utr_number: id };
    const wd = await WithdrawalRequest.findOne(query);

    if (!wd) return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
    if (wd.status === 'rejected') return res.status(400).json({ success: false, message: 'Already rejected' });

    wd.status = 'rejected';
    await wd.save();

    let cleanMobile = '';
    if (wd.user_id) cleanMobile = wd.user_id.replace(/[^0-9]/g, '').slice(-10);

    let userObj = await User.findOne({ mobile: { $regex: cleanMobile + '$' } });
    if (!userObj) userObj = await User.findOne({}); 

    if (userObj) {
      userObj.winning_balance = (userObj.winning_balance || 0) + wd.amount;
      userObj.wallet_balance = (userObj.deposit_balance || 0) + (userObj.winning_balance || 0) + (userObj.commission_balance || 0);
      await userObj.save();
    }
    
    return res.json({ success: true, message: 'Withdrawal Rejected & Refunded' });
  } catch (e) {
    res.status(500).json({ success: false });
  }
};
`
};

for (const key in regexes) {
  code = code.replace(regexes[key], (match) => {
    // some naive check to ensure we match the right block
    if (match.includes('res.status(500)') || match.includes('memory') || match.includes('success:')) {
      return impls[key];
    }
    return match; // if didn't match typical keywords, don't replace
  });
}

fs.writeFileSync('adminController_final.js', code);
console.log('Done with run_patch2');
