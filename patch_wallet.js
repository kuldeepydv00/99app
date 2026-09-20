const fs = require('fs');

let content = fs.readFileSync('adminController_patched.js', 'utf-8');

const updateUserWalletImpl = `
const updateUserWallet = async (req, res) => {
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

    // Log transaction
    try {
      const { logLedgerTransaction } = require('../store');
      logLedgerTransaction({
        user: targetUser.name || 'User',
        email: targetUser.email || \`\${targetUser.mobile}@gmail.com\`,
        phone: targetUser.mobile,
        amount: (type === 'add' ? \`+\${val.toFixed(2)}\` : \`-\${val.toFixed(2)}\`),
        transactType: transactType || (type === 'add' ? 'Deposit Manually' : 'Withdrawl Decline'),
        oldBal,
        newBal,
        gameType: '-'
      });
    } catch (e) {}

    return res.json({ success: true, message: \`Wallet updated for \${targetUser.name}\`, newBalance: newWallet, user: targetUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
`;

content = content.replace(/const updateUserWallet = async \(req, res\) => {[\s\S]*?(?=\n\/\/ @desc\s+Get promotional banner)/, updateUserWalletImpl.trim() + '\n\n');
fs.writeFileSync('adminController_patched.js', content);
console.log('Done replacing updateUserWallet');
