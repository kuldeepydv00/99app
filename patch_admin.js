const fs = require('fs');

let content = fs.readFileSync('adminController.js', 'utf-8');

// 1. Rewrite getUsers
const getUsersImpl = `
const getUsers = async (req, res) => {
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
content = content.replace(/const getUsers = async \(req, res\) => {[\s\S]*?(?=\n\/\/ @desc\s+Get live matrix)/, getUsersImpl.trim() + '\n\n');

// 2. Rewrite getAdminBets
const getAdminBetsImpl = `
const getAdminBets = async (req, res) => {
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
};
`;
content = content.replace(/const getAdminBets = async \(req, res\) => {[\s\S]*?(?=\n\/\/ @desc\s+Update bid)/, getAdminBetsImpl.trim() + '\n\n');


fs.writeFileSync('adminController_patched.js', content);
console.log('Done replacing getUsers and getAdminBets');
