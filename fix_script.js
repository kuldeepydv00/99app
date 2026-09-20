const mongoose = require('mongoose');
const fs = require('fs');

// Patch adminController.js Date bug
const file = '/var/www/matka-backend/src/controllers/adminController.js';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  /dbu\.createdAt \? new Date\(dbu\.createdAt\)\.toISOString\(\) : new Date\(\)\.toISOString\(\)/g,
  "(dbu.createdAt && !isNaN(new Date(dbu.createdAt))) ? new Date(dbu.createdAt).toISOString() : new Date().toISOString()"
);
fs.writeFileSync(file, content);

mongoose.connect('mongodb://127.0.0.1:27017/matka').then(async () => {
  const User = require('/var/www/matka-backend/src/models/User');
  const store = JSON.parse(fs.readFileSync('/var/www/matka-backend/src/dataStore.json'));
  let count = 0;
  for (let u of store.registeredUsers || []) {
    let cleanMobile = (u.mobile || '').replace(/[^0-9]/g, '').slice(-10);
    if(cleanMobile) {
      await User.findOneAndUpdate(
        { mobile: { $regex: new RegExp(cleanMobile + '$') } },
        { $setOnInsert: { wallet_balance: u.balance || 0, name: u.name, mobile: cleanMobile, password: u.password || '123' } },
        { upsert: true }
      );
      count++;
    }
  }
  console.log("Migration complete! Users synced: " + count);
  process.exit(0);
});
