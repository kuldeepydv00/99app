const fs = require('fs');
let code = fs.readFileSync('admin-panel/src/App.tsx', 'utf8');

// 1. Update getMarketBreakdown signature and logic
const oldGetMarketBreakdown = `  const getMarketBreakdown = (categoryName: string) => {
    const jodiMap: { [key: string]: number } = {};
    const crossMap: { [key: string]: number } = {};
    const haroofAnderMap: { [key: string]: number } = {};
    const haroofBaharMap: { [key: string]: number } = {};

    let jodiTotal = 0;
    let crossTotal = 0;
    let haroofTotal = 0;

    bidsList.forEach(b => {
      if (b.category === categoryName) {`;
      
const newGetMarketBreakdown = `  const getMarketBreakdown = (categoryName: string, startDate?: string, endDate?: string) => {
    const jodiMap: { [key: string]: number } = {};
    const crossMap: { [key: string]: number } = {};
    const haroofAnderMap: { [key: string]: number } = {};
    const haroofBaharMap: { [key: string]: number } = {};

    let jodiTotal = 0;
    let crossTotal = 0;
    let haroofTotal = 0;

    bidsList.forEach(b => {
      if (b.category === categoryName) {
        if (startDate || endDate) {
          const bDate = b.date || (b.created_at ? new Date(b.created_at).toISOString() : new Date().toISOString());
          if (!isDateInRange(bDate, startDate, endDate)) return;
        }`;

code = code.replace(oldGetMarketBreakdown, newGetMarketBreakdown);

// 2. Update the Game History mapping inside the table
const oldGameHistoryMapping = `                      {categoriesList.filter(c => {
                        const targetCat = appliedCategory !== 'All' ? appliedCategory : filterCategory;
                        if (targetCat !== 'All' && c.name !== targetCat) return false;
                        return true;
                      }).map((c, i) => {
                        const bd = getMarketBreakdown(c.name);
                        const bonusAmt = (bd.totalInvestment * 0.0005).toFixed(2);
                        return (
                          <tr key={i} className="hover:bg-[#F4F6F9] align-top">
                            <td className="p-2.5 border-r border-[#DEE2E6]">{i + 1}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6]">2026-08-29</td>`;

const newGameHistoryMapping = `                      {categoriesList.filter(c => {
                        const targetCat = appliedCategory !== 'All' ? appliedCategory : filterCategory;
                        if (targetCat !== 'All' && c.name !== targetCat) return false;
                        return true;
                      }).map((c, i) => {
                        const sDate = appliedStartDate || filterStartDate;
                        const eDate = appliedEndDate || filterEndDate;
                        const bd = getMarketBreakdown(c.name, sDate, eDate);
                        const bonusAmt = (bd.totalInvestment * 0.0005).toFixed(2);
                        
                        let displayDate = 'All Time';
                        if (sDate && eDate && sDate === eDate) displayDate = sDate;
                        else if (sDate || eDate) displayDate = \`\${sDate || '?'} to \${eDate || '?'}\`;
                        
                        return (
                          <tr key={i} className="hover:bg-[#F4F6F9] align-top">
                            <td className="p-2.5 border-r border-[#DEE2E6]">{i + 1}</td>
                            <td className="p-2.5 border-r border-[#DEE2E6] font-mono whitespace-nowrap">{displayDate}</td>`;

code = code.replace(oldGameHistoryMapping, newGameHistoryMapping);

fs.writeFileSync('admin-panel/src/App.tsx', code);
console.log('Patched Game History logic');
