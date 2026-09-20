const fs = require('fs');
let code = fs.readFileSync('adminController.js', 'utf8');

const replacements = [
  {
    regex: /const getUsers = async \(req, res\) => \{[\s\S]*?\n\};\n/g,
    replacer: (match) => {
      if (match.includes('getLiveMatrix')) return match;
      if (match.includes('dbUsers.forEach(dbu => {')) {
        return `const getUsers = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const User = require('../models/User');
    const dbUsers = await User.find({}).sort({createdAt: -1}).lean();
    
    const usersList = dbUsers.map(dbu => {
      const cleanMobile = (dbu.mobile || '').replace(/[^0-9]/g, '').slice(-10);
      return {
        id: dbu._id.toString(),
        name: dbu.name || dbu.username || \`User \${cleanMobile.slice(-4)}\`,
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
};
`;
      }
      return match;
    }
  },
  {
    regex: /const updateUserWallet = async \(req, res\) => \{[\s\S]*?\n\};\n/g,
    replacer: (match) => {
      if (match.includes('targetUser.balance = parseFloat(') && match.includes('const newBal = {')) {
        return `const updateUserWallet = async (req, res) => {
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

    return res.json({ success: true, message: \`Wallet updated for \${targetUser.name}\`, newBalance: newWallet, user: targetUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
`;
      }
      return match;
    }
  }
];

replacements.forEach(r => {
  code = code.replace(r.regex, r.replacer);
});

fs.writeFileSync('adminController_final.js', code);
console.log('Script run successfully');
