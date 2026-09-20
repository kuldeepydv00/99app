const fs = require('fs');
const file = 'backend/src/controllers/adminController.js';
let content = fs.readFileSync(file, 'utf8');

const anchor = `      if (bet.bet_type === 'HAROOF_ANDER') {
        if (parseInt(bet.number) === anderDigit) {
          isWin = true;
          payout = bet.bet_amount * 9.5;
        }
      } else if (bet.bet_type === 'HAROOF_BAHAR') {
        if (parseInt(bet.number) === baharDigit) {
          isWin = true;
          payout = bet.bet_amount * 9.5;
        }
      } else {
        // Jodi / Crossing bets (95x payout)
        if (parseInt(bet.number) === numVal) {
          isWin = true;
          payout = bet.bet_amount * 95;
        }
      }`;

const replacement = `      const bTypeStr = (bet.bet_type || '').toUpperCase().replace('_', ' ');
      if (bTypeStr.includes('ANDER') && (bTypeStr.includes('HAROOF') || bTypeStr.includes('HARUF'))) {
        if (parseInt(bet.number) === anderDigit) {
          isWin = true;
          payout = bet.bet_amount * 9.5;
        }
      } else if (bTypeStr.includes('BAHAR') && (bTypeStr.includes('HAROOF') || bTypeStr.includes('HARUF'))) {
        if (parseInt(bet.number) === baharDigit) {
          isWin = true;
          payout = bet.bet_amount * 9.5;
        }
      } else {
        // Jodi / Crossing bets (95x payout)
        if (parseInt(bet.number) === numVal) {
          isWin = true;
          payout = bet.bet_amount * 95;
        }
      }`;

content = content.replace(anchor, replacement);
fs.writeFileSync(file, content);
console.log("Patched adminController.js");
