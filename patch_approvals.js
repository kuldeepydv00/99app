const fs = require('fs');
let content = fs.readFileSync('adminController_patched.js', 'utf-8');

const approvalsImpl = `
const approveDeposit = async (req, res) => {
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
    if (!userObj) userObj = await User.findOne({}); // fallback like original

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
          amount: \`+\${totalCredit.toFixed(2)}\`,
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
};

const rejectDeposit = async (req, res) => {
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

const approveWithdrawal = async (req, res) => {
  const { id } = req.params;
  try {
    const mongoose = require('mongoose');
    const WithdrawalRequest = require('../models/WithdrawalRequest');
    const User = require('../models/User');

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

const rejectWithdrawal = async (req, res) => {
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
`;

content = content.replace(/const approveDeposit = async \(req, res\) => {[\s\S]*?(?=\n\/\/ @desc\s+Declare Game Result)/, approvalsImpl.trim() + '\n\n');
fs.writeFileSync('adminController_patched.js', content);
console.log('Done replacing approvals');
