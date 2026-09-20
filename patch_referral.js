const fs = require('fs');
const file = '/var/www/matka-backend/src/store.js';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/signupBonus: 50,/g, 'signupBonus: 0,');
fs.writeFileSync(file, content);

const jsonFile = '/var/www/matka-backend/src/dataStore.json';
if (fs.existsSync(jsonFile)) {
  let data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  if (data.referralConfig) {
    data.referralConfig.signupBonus = 0;
    fs.writeFileSync(jsonFile, JSON.stringify(data, null, 2));
  }
}
console.log("Patched referral bonus!");
