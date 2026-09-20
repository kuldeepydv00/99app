const fs = require('fs');
let code = fs.readFileSync('admin-panel/src/App.tsx', 'utf8');

const oldLedgerMap = `timeline = [
        ...bidsList.map(b => ({ ...b, type: 'Bid', time: new Date(b.date).getTime() })),
        ...winningsList.map(w => ({ ...w, type: 'Winning', time: new Date(w.date || w.dateOfWinning).getTime() }))
      ]`;
const newLedgerMap = `timeline = [
        ...bidsList.map(b => ({ ...b, type: 'Bid', time: new Date(b.rawDate || b.date).getTime() })),
        ...winningsList.map(w => ({ ...w, type: 'Winning', time: new Date(w.rawDate || w.date || w.dateOfWinning).getTime() }))
      ]`;
code = code.replace(oldLedgerMap, newLedgerMap);

const oldLedgerDate = `const itemDate = x.date || x.dateOfWinning;
                        if (!isDateInRange(itemDate, sDate, eDate)) return false;`;
const newLedgerDate = `const itemDate = x.rawDate || x.date || x.dateOfWinning;
                        if (!isDateInRange(itemDate, sDate, eDate)) return false;`;
code = code.replace(oldLedgerDate, newLedgerDate);

fs.writeFileSync('admin-panel/src/App.tsx', code);
console.log('Date fully patched');
