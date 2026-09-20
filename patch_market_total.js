const fs = require('fs');
const file = 'admin-panel/src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Replace getMarketBetTotal function
const oldFunc = `  // Calculate Market Total Beted Amount for Result Declaration Modal
  const getMarketBetTotal = (catName: string) => {
    return bidsList
      .filter(b => b.category.toLowerCase() === catName.toLowerCase())
      .reduce((sum, b) => sum + (b.amount || 0), 0);
  };`;

const newFunc = `  // Calculate Market Total Beted Amount for Result Declaration Modal (date-specific)
  const getMarketBetTotal = (catName: string, dateStr?: string) => {
    const targetDate = dateStr || resultForm.resultDate || new Date().toISOString().split('T')[0];
    return bidsList
      .filter(b => {
        const catMatch = String(b.category || '').trim().toLowerCase() === String(catName || '').trim().toLowerCase();
        if (!catMatch) return false;
        
        const bDateVal = b.rawDate || b.date || b.created_at;
        if (!bDateVal) return false;

        try {
          const d = new Date(bDateVal);
          if (!isNaN(d.getTime())) {
            const dStr = \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}-\${String(d.getDate()).padStart(2, '0')}\`;
            if (dStr === targetDate) return true;
          }
          const str = String(bDateVal);
          if (str.includes(targetDate)) return true;
        } catch (e) {}

        return false;
      })
      .reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);
  };

  const getMarketLifetimeTotal = (catName: string) => {
    return bidsList
      .filter(b => String(b.category || '').trim().toLowerCase() === String(catName || '').trim().toLowerCase())
      .reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);
  };`;

if (content.includes(oldFunc)) {
  content = content.replace(oldFunc, newFunc);
  console.log('Patched getMarketBetTotal function successfully!');
} else {
  console.log('Could not match oldFunc');
}

// 2. Replace Modal JSX card
const oldModalCard = `              {/* MARKET TOTAL BET AMOUNT DISPLAY CARD */}
              <div className="bg-blue-50 border border-blue-200 p-3 rounded text-center">
                <p className="text-[11px] text-gray-600 font-medium">Total Amount Beted on Market today:</p>
                <p className="text-xl font-bold font-mono text-[#007BFF]">₹ {getMarketBetTotal(resultForm.category)}.00</p>
              </div>`;

const newModalCard = `              {/* MARKET TOTAL BET AMOUNT DISPLAY CARD */}
              <div className="bg-blue-50 border border-blue-200 p-3 rounded space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-600 font-medium">Total Bets on {resultForm.resultDate}:</span>
                  <span className="font-bold font-mono text-base text-[#007BFF]">₹ {getMarketBetTotal(resultForm.category, resultForm.resultDate)}.00</span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-gray-500 pt-1 border-t border-blue-200/60">
                  <span>Lifetime Bets on {resultForm.category}:</span>
                  <span className="font-mono font-semibold text-gray-700">₹ {getMarketLifetimeTotal(resultForm.category)}.00</span>
                </div>
              </div>`;

if (content.includes(oldModalCard)) {
  content = content.replace(oldModalCard, newModalCard);
  console.log('Patched Modal Card JSX successfully!');
} else {
  console.log('Could not match oldModalCard');
}

// 3. Fix Dashboard today bets calculation
const oldDashBet = "const todayBetVal = stats.todayBetting !== undefined ? stats.todayBetting : bidsList.filter(b => isToday(b.date)).reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);";
const newDashBet = "const todayBetVal = stats.todayBetting !== undefined ? stats.todayBetting : bidsList.filter(b => isToday(b.rawDate || b.date || b.created_at)).reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);";

if (content.includes(oldDashBet)) {
  content = content.replace(oldDashBet, newDashBet);
  console.log('Patched Dashboard todayBetVal successfully!');
}

fs.writeFileSync(file, content);
