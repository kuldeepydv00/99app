const fs = require('fs');
const file = 'backend/src/controllers/adminController.js';
let content = fs.readFileSync(file, 'utf8');

// Find where deleteUser starts
const startIdx = content.indexOf('const deleteUser = async (req, res) => {');
const nextFuncIdx = content.indexOf('const deleteAdminBid = async (req, res) => {');

if (startIdx !== -1 && nextFuncIdx !== -1) {
  const newFunc = `const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { registeredUsers, saveDiskStore } = require('../store');
    
    // 1. Remove from Memory
    for (let i = registeredUsers.length - 1; i >= 0; i--) {
      const u = registeredUsers[i];
      if (String(u._id) === String(id) || String(u.id) === String(id) || String(u.mobile) === String(id)) {
        registeredUsers.splice(i, 1);
      }
    }
    saveDiskStore();
    
    // 2. Remove from MongoDB permanently
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const User = require('../models/User');
      
      const query = { $or: [] };
      if (mongoose.Types.ObjectId.isValid(id)) {
        query.$or.push({ _id: new mongoose.Types.ObjectId(id) });
        query.$or.push({ _id: id });
      }
      query.$or.push({ mobile: new RegExp(id + "$") });
      
      await User.deleteMany(query).catch(()=>{});
    }
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
};

`;
  
  content = content.substring(0, startIdx) + newFunc + content.substring(nextFuncIdx);
  fs.writeFileSync(file, content);
  console.log("Fixed deleteUser");
}
