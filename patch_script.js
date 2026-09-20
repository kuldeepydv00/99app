const fs = require('fs');

let file1 = '/var/www/matka-backend/src/controllers/userController.js';
let content1 = fs.readFileSync(file1, 'utf8');
content1 = content1.replace(
  /\{ mobile: cleanMobile \}/g,
  "{ mobile: { $regex: new RegExp(cleanMobile + '$') } }"
);
fs.writeFileSync(file1, content1);

let file2 = '/var/www/matka-backend/src/controllers/gameController.js';
let content2 = fs.readFileSync(file2, 'utf8');
content2 = content2.replace(
  /const inMemoryUserBets = memoryBets\.filter\(b => b\.user && b\.user\.replace\(\/\[\^0-9\]\/g, ''\)\.slice\(-10\) === cleanMobile\);/g,
  "const inMemoryUserBets = memoryBets.filter(b => String(b.mobile || b.phone || b.user || '').replace(/[^0-9]/g, '').slice(-10) === cleanMobile);"
);
content2 = content2.replace(
  /const dbBets = await Bet\.find\(\{ \$or: \[\{ mobile: cleanMobile \}, \{ user: cleanMobile \}\] \}\)\.lean\(\);/g,
  "const dbBets = await Bet.find({ $or: [{ mobile: { \\$regex: new RegExp(cleanMobile + '\\$') } }, { user: { \\$regex: new RegExp(cleanMobile + '\\$') } }] }).lean();"
);
fs.writeFileSync(file2, content2);
console.log("Patched successfully!");
