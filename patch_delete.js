const fs = require('fs');
const file = 'backend/src/controllers/adminController_remote.js';
let content = fs.readFileSync(file, 'utf8');

const anchor = `const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { registeredUsers, saveDiskStore } = require('../store');
    const index = registeredUsers.findIndex(u => String(u._id) === String(id) || String(u.mobile) === String(id));
    if (index !== -1) {
      registeredUsers.splice(index, 1);
      saveDiskStore();
    }
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const User = require('../models/User');
      await User.deleteOne({ $or: [{ _id: id }, { mobile: id }] }).catch(()=>{});
    }
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
};`;

const replacement = `const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { registeredUsers, saveDiskStore } = require('../store');
    
    let deletedCount = 0;
    for (let i = registeredUsers.length - 1; i >= 0; i--) {
      const u = registeredUsers[i];
      if (String(u._id) === String(id) || String(u.mobile) === String(id)) {
        registeredUsers.splice(i, 1);
        deletedCount++;
      }
    }
    if (deletedCount > 0) saveDiskStore();
    
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const User = require('../models/User');
      
      const orConditions = [];
      if (mongoose.Types.ObjectId.isValid(id)) {
        orConditions.push({ _id: new mongoose.Types.ObjectId(id) });
        orConditions.push({ _id: id });
      }
      orConditions.push({ mobile: new RegExp(id + "$") });
      
      await User.deleteMany({ $or: orConditions }).catch(()=>{});
    }
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
};`;

if (content.includes(anchor)) {
  content = content.replace(anchor, replacement);
  fs.writeFileSync(file, content);
  console.log("Patched successfully.");
} else {
  console.log("Anchor not found!");
}
