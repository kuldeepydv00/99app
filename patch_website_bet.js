const fs = require('fs');
const file = 'website/src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const anchor1 = `bets: activeBets.map(b => ({ number: b.num, bet_amount: b.amt })),`;
const replacement1 = `bets: activeBets.map(b => ({ number: b.num, bet_amount: b.amt, bet_type: b.type || betCategory.toUpperCase() })),`;

const anchor2 = `bet_type: betCategory.toUpperCase(),
          number: b.num,`;
const replacement2 = `bet_type: b.type || betCategory.toUpperCase(),
          number: b.num,`;

content = content.replace(anchor1, replacement1);
content = content.replace(anchor2, replacement2);

fs.writeFileSync(file, content);
console.log("Patched website App.tsx");
