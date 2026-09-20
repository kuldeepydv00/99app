const fs = require('fs');
let content = fs.readFileSync('adminController_patched.js', 'utf-8');

const getDepositsImpl = `
const getDeposits = async (req, res) => {
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
`;

const getWithdrawalsImpl = `
const getWithdrawals = async (req, res) => {
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
`;

content = content.replace(/const getDeposits = async \(req, res\) => {[\s\S]*?(?=\n\/\/ @desc\s+Create deposit)/, getDepositsImpl.trim() + '\n\n');
content = content.replace(/const getWithdrawals = async \(req, res\) => {[\s\S]*?(?=\n\/\/ @desc\s+Create withdrawal)/, getWithdrawalsImpl.trim() + '\n\n');

fs.writeFileSync('adminController_patched.js', content);
console.log('Done replacing getDeposits and getWithdrawals');
