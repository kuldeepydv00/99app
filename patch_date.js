const fs = require('fs');
let code = fs.readFileSync('admin-panel/src/App.tsx', 'utf8');

// 1. Add rawDate to bids in fetchLiveData
const oldBidMap = `id: b._id || b.id || \`bid_\${idx}_\${Date.now()}\`,
            date: b.created_at ? new Date(b.created_at).toLocaleString() : '2026-08-29 09:51:51',
            user: b.user || b.username || 'User',`;
const newBidMap = `id: b._id || b.id || \`bid_\${idx}_\${Date.now()}\`,
            date: b.created_at ? new Date(b.created_at).toLocaleString('en-IN') : '2026-08-29 09:51:51',
            rawDate: b.created_at || new Date().toISOString(),
            user: b.user || b.username || 'User',`;
code = code.replace(oldBidMap, newBidMap);

// 2. Add rawDate to results in fetchLiveData
const oldResultMap = `id: r._id || r.id,
            date: r.date || r.created_at ? new Date(r.created_at || r.date).toLocaleDateString() : 'N/A',
            category: r.game_name || r.category,`;
const newResultMap = `id: r._id || r.id,
            date: r.date || r.created_at ? new Date(r.created_at || r.date).toLocaleDateString('en-IN') : 'N/A',
            rawDate: r.created_at || r.date || new Date().toISOString(),
            category: r.game_name || r.category,`;
code = code.replace(oldResultMap, newResultMap);

// 3. Update getMarketBreakdown to use rawDate
const oldMarketDate = `const bDate = b.date || (b.created_at ? new Date(b.created_at).toISOString() : new Date().toISOString());
          if (!isDateInRange(bDate, startDate, endDate)) return;`;
const newMarketDate = `const bDate = b.rawDate || b.date;
          if (!isDateInRange(bDate, startDate, endDate)) return;`;
code = code.replace(oldMarketDate, newMarketDate);

// 4. Update Bids Management table filter to use rawDate
const oldBidsFilterDate = `const sDate = appliedStartDate || filterStartDate;
                        const eDate = appliedEndDate || filterEndDate;
                        if (!isDateInRange(b.date, sDate, eDate)) return false;`;
const newBidsFilterDate = `const sDate = appliedStartDate || filterStartDate;
                        const eDate = appliedEndDate || filterEndDate;
                        if (!isDateInRange(b.rawDate || b.date, sDate, eDate)) return false;`;
code = code.replace(oldBidsFilterDate, newBidsFilterDate);

// 5. Update Game Ledger filter to use rawDate
const oldLedgerDate = `if (!isDateInRange(x.date, sDate, eDate)) return false;`;
const newLedgerDate = `if (!isDateInRange(x.rawDate || x.date, sDate, eDate)) return false;`;
// Wait, Game Ledger filters use a combined timeline array. Let's trace it carefully!
