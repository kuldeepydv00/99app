const fs = require('fs');
let lines = fs.readFileSync('adminController.js', 'utf-8').split('\n');

function replaceFunc(linesArray, funcName, newImpl) {
  let startIndex = -1;
  let braceCount = 0;
  let inFunc = false;
  let endIndex = -1;

  for (let i = 0; i < linesArray.length; i++) {
    const line = linesArray[i];
    
    if (!inFunc) {
      if (line.includes(\`const \${funcName} = async\`)) {
        startIndex = i;
        inFunc = true;
      }
    }

    if (inFunc) {
      const openBraces = (line.match(/\\{/g) || []).length;
      const closeBraces = (line.match(/\\}/g) || []).length;
      braceCount += openBraces;
      braceCount -= closeBraces;
      
      if (braceCount === 0 && openBraces === 0 && closeBraces > 0) {
        // Fallback for single line closing brace
      }
      
      if (braceCount === 0 && startIndex !== i) {
        endIndex = i;
        break;
      }
    }
  }

  if (startIndex !== -1 && endIndex !== -1) {
    console.log(\`Replaced \${funcName} from line \${startIndex} to \${endIndex}\`);
    linesArray.splice(startIndex, endIndex - startIndex + 1, newImpl);
  } else {
    console.log(\`Function \${funcName} not found or parsing failed\`);
  }
}

const getUsersImpl = \`const getUsers = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const User = require('../models/User');
    const dbUsers = await User.find({}).sort({createdAt: -1}).lean();
    
    const usersList = dbUsers.map(dbu => {
      const cleanMobile = (dbu.mobile || '').replace(/[^0-9]/g, '').slice(-10);
      return {
        id: dbu._id.toString(),
        name: dbu.name || dbu.username || \\\`User \\\${cleanMobile.slice(-4)}\\\`,
        mobile: cleanMobile,
        balance: dbu.wallet_balance || 0,
        deposit_balance: dbu.deposit_balance || 0,
        winning_balance: dbu.winning_balance || 0,
        bonus_balance: dbu.bonus_balance !== undefined ? dbu.bonus_balance : 200.00,
        commission_balance: dbu.commission_balance || 0,
        status: dbu.is_active === false ? 'Inactive' : 'Active',
        createdAt: dbu.createdAt ? new Date(dbu.createdAt).toISOString() : new Date().toISOString(),
        referral_code: dbu.referral_code || '',
        referred_by: dbu.referred_by || ''
      };
    });
    return res.json(usersList);
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};\`;

const getAdminBetsImpl = \`const getAdminBets = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const Bet = require('../models/Bet');
    const dbBets = await Bet.find({}).sort({ createdAt: -1 }).lean();
    const formatted = dbBets.map(b => ({
      _id: b._id.toString(),
      id: b._id.toString(),
      user: b.username || b.mobile || 'User',
      mobile: b.mobile || 'N/A',
      game_name: b.game_name,
      category: b.game_name,
      number: b.number,
      bet_amount: b.bet_amount,
      amount: b.bet_amount,
      potential_payout: b.potential_payout || (b.bet_amount * 95),
      status: b.status || 'pending',
      win_amount: b.win_amount || 0,
      created_at: b.createdAt ? new Date(b.createdAt).toISOString() : new Date().toISOString(),
      date: b.createdAt ? new Date(b.createdAt).toISOString() : new Date().toISOString()
    }));
    return res.json(formatted);
  } catch (e) {
    console.error('[Admin Bets Error]', e);
    res.status(500).json({ success: false });
  }
};\`;

const updateUserWalletImpl = \`const updateUserWallet = async (req, res) => {
  const { userId, mobile, type, walletType, transactType, amount } = req.body;
  const val = parseFloat(amount) || 0;

  try {
    const mongoose = require('mongoose');
    const User = require('../models/User');

    const cleanMobile = mobile ? mobile.replace(/[^0-9]/g, '').slice(-10) : (userId ? userId.replace(/[^0-9]/g, '').slice(-10) : '');
    
    let query = {};
    if (cleanMobile) {
      query = { mobile: { $regex: cleanMobile + '$' } };
    } else if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      query = { _id: userId };
    } else {
      return res.status(400).json({ success: false, message: 'Invalid user identifier' });
    }

    const targetUser = await User.findOne(query);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const oldBal = {
      wallet: (targetUser.wallet_balance || 0).toFixed(2),
      deposit: (targetUser.deposit_balance || 0).toFixed(2),
      winning: (targetUser.winning_balance || 0).toFixed(2),
      commission: (targetUser.commission_balance || 0).toFixed(2),
      bonus: (targetUser.bonus_balance || 200).toFixed(2),
      referral: ((targetUser.referrals_count || 0) * 33).toFixed(2)
    };

    const targetKey = walletType || 'deposit';
    let dep = targetUser.deposit_balance || 0;
    let win = targetUser.winning_balance || 0;
    let bon = targetUser.bonus_balance !== undefined ? targetUser.bonus_balance : 200;
    let com = targetUser.commission_balance || 0;

    if (type === 'add') {
      if (targetKey === 'deposit') dep += val;
      else if (targetKey === 'winning') win += val;
      else if (targetKey === 'bonus') bon += val;
      else if (targetKey === 'commission') com += val;
      else dep += val;
    } else {
      if (targetKey === 'deposit') dep = Math.max(0, dep - val);
      else if (targetKey === 'winning') win = Math.max(0, win - val);
      else if (targetKey === 'bonus') bon = Math.max(0, bon - val);
      else if (targetKey === 'commission') com = Math.max(0, com - val);
      else dep = Math.max(0, dep - val);
    }

    const newWallet = parseFloat((dep + win + com).toFixed(2));

    targetUser.deposit_balance = dep;
    targetUser.winning_balance = win;
    targetUser.bonus_balance = bon;
    targetUser.commission_balance = com;
    targetUser.wallet_balance = newWallet;

    await targetUser.save();

    const newBal = {
      wallet: newWallet.toFixed(2),
      deposit: dep.toFixed(2),
      winning: win.toFixed(2),
      commission: com.toFixed(2),
      bonus: bon.toFixed(2),
      referral: ((targetUser.referrals_count || 0) * 33).toFixed(2)
    };

    try {
      const { logLedgerTransaction } = require('../store');
      logLedgerTransaction({
        user: targetUser.name || 'User',
        email: targetUser.email || \\\`\\\${targetUser.mobile}@gmail.com\\\`,
        phone: targetUser.mobile,
        amount: (type === 'add' ? \\\`+\\\${val.toFixed(2)}\\\` : \\\`-\\\${val.toFixed(2)}\\\`),
        transactType: transactType || (type === 'add' ? 'Deposit Manually' : 'Withdrawl Decline'),
        oldBal,
        newBal,
        gameType: '-'
      });
    } catch (e) {}

    return res.json({ success: true, message: \\\`Wallet updated for \\\${targetUser.name}\\\`, newBalance: newWallet, user: targetUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};\`;

const getStatsImpl = \`const getStats = async (req, res) => {
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
};\`;

const getDepositsImpl = \`const getDeposits = async (req, res) => {
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
};\`;

const getWithdrawalsImpl = \`const getWithdrawals = async (req, res) => {
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
};\`;

const approveDepositImpl = \`const approveDeposit = async (req, res) => {
  const { id } = req.params;
  try {
    const mongoose = require('mongoose');
    const DepositRequest = require('../models/DepositRequest');
    const User = require('../models/User');

    let query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { utr_number: id };
    const dep = await DepositRequest.findOne(query);

    if (!dep) return res.status(404).json({ success: false, message: 'Deposit request not found' });
    if (dep.status === 'approved') return res.status(400).json({ success: false, message: 'Already approved' });

    dep.status = 'approved';
    await dep.save();

    let cleanMobile = '';
    if (dep.user_id) cleanMobile = dep.user_id.replace(/[^0-9]/g, '').slice(-10);

    let userObj = await User.findOne({ mobile: { $regex: cleanMobile + '$' } });
    if (!userObj) userObj = await User.findOne({}); 

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

      try {
        const { logLedgerTransaction } = require('../store');
        logLedgerTransaction({
          user: userObj.name || 'User',
          phone: userObj.mobile,
          amount: \\\`+\\\${totalCredit.toFixed(2)}\\\`,
          transactType: 'Deposit Approved',
          oldBal: { wallet: (userObj.wallet_balance - totalCredit).toFixed(2) },
          newBal: { wallet: userObj.wallet_balance.toFixed(2) },
          gameType: '-'
        });
      } catch (e) {}

      return res.json({ success: true, message: 'Deposit Approved', updatedBalance: userObj.wallet_balance });
    }
    return res.json({ success: true, message: 'Deposit Approved (User balance not synced)' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false });
  }
};\`;

const rejectDepositImpl = \`const rejectDeposit = async (req, res) => {
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
};\`;

const approveWithdrawalImpl = \`const approveWithdrawal = async (req, res) => {
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
};\`;

const rejectWithdrawalImpl = \`const rejectWithdrawal = async (req, res) => {
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
};\`;

replaceFunc(lines, 'getUsers', getUsersImpl);
replaceFunc(lines, 'getAdminBets', getAdminBetsImpl);
replaceFunc(lines, 'updateUserWallet', updateUserWalletImpl);
replaceFunc(lines, 'getStats', getStatsImpl);
replaceFunc(lines, 'getDeposits', getDepositsImpl);
replaceFunc(lines, 'getWithdrawals', getWithdrawalsImpl);
replaceFunc(lines, 'approveDeposit', approveDepositImpl);
replaceFunc(lines, 'rejectDeposit', rejectDepositImpl);
replaceFunc(lines, 'approveWithdrawal', approveWithdrawalImpl);
replaceFunc(lines, 'rejectWithdrawal', rejectWithdrawalImpl);

fs.writeFileSync('adminController_final.js', lines.join('\n'));
