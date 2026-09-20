const fs = require('fs');
const file = 'admin-panel/src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace Game Ledger (Tab 6)
const oldLedgerBlock = `                  {/* TAB 6: GAME LEDGER */}
                  {userDetailsTab === 'gameLedger' && (
                    <div className="p-4 space-y-4 text-xs">
                      <h3 className="font-bold text-[#212529] text-sm">40-Day Stacked Game Ledger</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6] whitespace-nowrap">
                          <thead className="bg-[#F8F9FA] text-[#495057] font-bold border-b border-[#DEE2E6]">
                            <tr>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Sr. No</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Amount</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Date</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Transact Type</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Old Bal.</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">New Bal.</th>
                              <th className="p-2.5">Game Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const realLedger: any[] = [];

                              // 1. Initial Joining Bonus Entry (+200.00)
                              realLedger.push({
                                amount: '+200.00',
                                date: selectedUser.createdAt ? selectedUser.createdAt.replace('T', ' ').slice(0, 19) : '2026-08-29 09:50:00',
                                type: 'Joining Bonus',
                                oldBal: { wallet: '0.00', deposit: '0.00', winning: '0.00', commission: '0.00', bonus: '0.00', referral: '0.00' },
                                newBal: { wallet: \`\${selectedUser.balance || 0}.00\`, deposit: \`\${selectedUser.deposit_balance || 0}.00\`, winning: \`\${selectedUser.winning_balance || 0}.00\`, commission: \`\${selectedUser.commission_balance || 0}.00\`, bonus: '200.00', referral: '0.00' },
                                gameType: '-'
                              });

                              // 2. Real User Bids
                              const userBids = bidsList.filter(b => b.user === selectedUser.name || b.phone === selectedUser.mobile);
                              userBids.forEach(b => {
                                realLedger.push({
                                  amount: \`-\${b.amount}.00\`,
                                  date: b.date || '2026-08-29 11:51:10',
                                  type: 'Bid Place',
                                  oldBal: { wallet: \`\${(selectedUser.balance || 0) + b.amount}.00\`, deposit: \`\${(selectedUser.deposit_balance || 0) + b.amount}.00\`, winning: '0.00', commission: '0.00', bonus: '200.00', referral: '0.00' },
                                  newBal: { wallet: \`\${selectedUser.balance || 0}.00\`, deposit: \`\${selectedUser.deposit_balance || 0}.00\`, winning: '0.00', commission: '0.00', bonus: '200.00', referral: '0.00' },
                                  gameType: b.gameType || 'Single Jodi'
                                });
                              });

                              return realLedger.map((item, i) => (
                                <tr key={i} className="hover:bg-[#F4F6F9] align-top">
                                  <td className="p-2.5 border-r border-[#DEE2E6]">{i + 1}</td>
                                  <td className={\`p-2.5 border-r border-[#DEE2E6] font-mono font-bold \${item.amount.startsWith('+') ? 'text-[#28A745]' : 'text-[#DC3545]'}\`}>{item.amount}</td>
                                  <td className="p-2.5 border-r border-[#DEE2E6] font-mono">{item.date}</td>
                                  <td className="p-2.5 border-r border-[#DEE2E6] font-medium">{item.type}</td>
                                  <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-[11px] space-y-0.5 text-gray-700">
                                    <div>Wallet - {item.oldBal.wallet}</div>
                                    <div>Deposit - {item.oldBal.deposit}</div>
                                    <div>Winning - {item.oldBal.winning}</div>
                                    <div>Commission - {item.oldBal.commission}</div>
                                    <div>Bonus - {item.oldBal.bonus}</div>
                                    <div>Referral - {item.oldBal.referral}</div>
                                  </td>
                                  <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-[11px] space-y-0.5 text-gray-700">
                                    <div>Wallet - {item.newBal.wallet}</div>
                                    <div>Deposit - {item.newBal.deposit}</div>
                                    <div>Winning - {item.newBal.winning}</div>
                                    <div>Commission - {item.newBal.commission}</div>
                                    <div>Bonus - {item.newBal.bonus}</div>
                                    <div>Referral - {item.newBal.referral}</div>
                                  </td>
                                  <td className="p-2.5 font-medium">{item.gameType}</td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}`;

const newLedgerBlock = `                  {/* TAB 6: GAME LEDGER */}
                  {userDetailsTab === 'gameLedger' && (
                    <div className="p-4 space-y-4 text-xs">
                      <h3 className="font-bold text-[#212529] text-sm">40-Day Stacked Game Ledger</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6] whitespace-nowrap">
                          <thead className="bg-[#F8F9FA] text-[#495057] font-bold border-b border-[#DEE2E6]">
                            <tr>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Sr. No</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Amount</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Date</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Transact Type</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Old Bal.</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">New Bal.</th>
                              <th className="p-2.5">Game Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const cleanMob = String(selectedUser.mobile || '').replace(/[^0-9]/g, '').slice(-10);

                              const matchesUser = (item: any) => {
                                const raw = String(item.mobile || item.phone || item.userPhone || item.user || item.username || '').replace(/[^0-9]/g, '');
                                const m = raw.length >= 10 ? raw.slice(-10) : '';
                                if (m && cleanMob && m === cleanMob) return true;
                                if (item.userId && String(item.userId) === String(selectedUser.id)) return true;
                                return false;
                              };

                              const events: any[] = [];
                              const signupDate = selectedUser.createdAt ? new Date(selectedUser.createdAt).getTime() : Date.now() - 86400000;

                              // 1. Initial Signup (Joining Bonus +200)
                              events.push({
                                timestamp: isNaN(signupDate) ? 0 : signupDate,
                                dateStr: selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : '01:21:00 AM',
                                type: 'Joining Bonus',
                                amount: 200,
                                amountStr: '+200.00',
                                gameType: '-',
                                kind: 'BONUS'
                              });

                              // 2. Approved Deposits
                              (deposits || []).filter(d => matchesUser(d) && (d.status === 'Approved' || d.status === 'approved')).forEach((d, idx) => {
                                const t = d.createdAt ? new Date(d.createdAt).getTime() : (d.date ? new Date(d.date).getTime() : (signupDate + 1000 + idx * 100));
                                events.push({
                                  timestamp: isNaN(t) ? (signupDate + 1000 + idx * 100) : t,
                                  dateStr: d.createdAt || d.date || 'Today',
                                  type: 'Deposit Approved',
                                  amount: parseFloat(d.amount) || 0,
                                  amountStr: \`+\${(parseFloat(d.amount) || 0).toFixed(2)}\`,
                                  gameType: d.method || d.payment_method || 'UPI / PhonePe',
                                  kind: 'DEPOSIT'
                                });
                              });

                              // 3. User Bids
                              (bidsList || []).filter(b => matchesUser(b)).forEach((b, idx) => {
                                const t = b.rawDate ? new Date(b.rawDate).getTime() : (b.date ? new Date(b.date).getTime() : (signupDate + 2000 + idx * 100));
                                const bAmt = parseFloat(b.amount) || 10;
                                events.push({
                                  timestamp: isNaN(t) ? (signupDate + 2000 + idx * 100) : t,
                                  dateStr: b.date || 'Today',
                                  type: 'Bid Place',
                                  amount: bAmt,
                                  amountStr: \`-\${bAmt.toFixed(2)}\`,
                                  gameType: \`\${b.category || 'Game'} - \${b.gameType || 'Jodi'} (#\${b.number})\`,
                                  kind: 'BET'
                                });

                                if (b.status === 'Won' || b.status === 'won') {
                                  const winAmt = (parseFloat(b.win_amount || b.winAmount) || (bAmt * 95));
                                  events.push({
                                    timestamp: (isNaN(t) ? (signupDate + 2000 + idx * 100) : t) + 50,
                                    dateStr: b.date || 'Today',
                                    type: 'Winning Credit',
                                    amount: winAmt,
                                    amountStr: \`+\${winAmt.toFixed(2)}\`,
                                    gameType: \`\${b.category || 'Game'} - Won 🎉\`,
                                    kind: 'WIN'
                                  });
                                }
                              });

                              // 4. Approved Withdrawals
                              (withdrawals || []).filter(w => matchesUser(w) && (w.status === 'Approved' || w.status === 'approved')).forEach((w, idx) => {
                                const t = w.createdAt ? new Date(w.createdAt).getTime() : (w.date ? new Date(w.date).getTime() : (signupDate + 3000 + idx * 100));
                                const wAmt = parseFloat(w.amount) || 0;
                                events.push({
                                  timestamp: isNaN(t) ? (signupDate + 3000 + idx * 100) : t,
                                  dateStr: w.createdAt || w.date || 'Today',
                                  type: 'Withdrawal Payout',
                                  amount: wAmt,
                                  amountStr: \`-\${wAmt.toFixed(2)}\`,
                                  gameType: 'Bank / UPI',
                                  kind: 'WITHDRAW'
                                });
                              });

                              // Sort chronological
                              events.sort((a, b) => a.timestamp - b.timestamp);

                              let runWallet = 0.00;
                              let runDeposit = 0.00;
                              let runWinning = 0.00;
                              let runCommission = 0.00;
                              let runBonus = 0.00;
                              let runReferral = 0.00;

                              const calculatedRows: any[] = [];

                              events.forEach(ev => {
                                const oldBal = {
                                  wallet: runWallet.toFixed(2),
                                  deposit: runDeposit.toFixed(2),
                                  winning: runWinning.toFixed(2),
                                  commission: runCommission.toFixed(2),
                                  bonus: runBonus.toFixed(2),
                                  referral: runReferral.toFixed(2)
                                };

                                if (ev.kind === 'BONUS') {
                                  runBonus += ev.amount;
                                } else if (ev.kind === 'DEPOSIT') {
                                  runDeposit += ev.amount;
                                  runWallet += ev.amount;
                                } else if (ev.kind === 'BET') {
                                  let rem = ev.amount;
                                  if (runDeposit >= rem) {
                                    runDeposit -= rem;
                                    rem = 0;
                                  } else {
                                    rem -= runDeposit;
                                    runDeposit = 0;
                                    if (runWinning >= rem) {
                                      runWinning -= rem;
                                      rem = 0;
                                    } else {
                                      rem -= runWinning;
                                      runWinning = 0;
                                    }
                                  }
                                  runWallet = Math.max(0, runDeposit + runWinning + runCommission);
                                } else if (ev.kind === 'WIN') {
                                  runWinning += ev.amount;
                                  runWallet = runDeposit + runWinning + runCommission;
                                } else if (ev.kind === 'WITHDRAW') {
                                  let rem = ev.amount;
                                  if (runWinning >= rem) {
                                    runWinning -= rem;
                                  } else {
                                    rem -= runWinning;
                                    runWinning = 0;
                                    runDeposit = Math.max(0, runDeposit - rem);
                                  }
                                  runWallet = Math.max(0, runDeposit + runWinning + runCommission);
                                }

                                const newBal = {
                                  wallet: runWallet.toFixed(2),
                                  deposit: runDeposit.toFixed(2),
                                  winning: runWinning.toFixed(2),
                                  commission: runCommission.toFixed(2),
                                  bonus: runBonus.toFixed(2),
                                  referral: runReferral.toFixed(2)
                                };

                                calculatedRows.push({
                                  amount: ev.amountStr,
                                  date: ev.dateStr,
                                  type: ev.type,
                                  oldBal,
                                  newBal,
                                  gameType: ev.gameType
                                });
                              });

                              return calculatedRows.reverse().map((item, i) => (
                                <tr key={i} className="hover:bg-[#F4F6F9] align-top">
                                  <td className="p-2.5 border-r border-[#DEE2E6]">{i + 1}</td>
                                  <td className={\`p-2.5 border-r border-[#DEE2E6] font-mono font-bold \${item.amount.startsWith('+') ? 'text-[#28A745]' : 'text-[#DC3545]'}\`}>{item.amount}</td>
                                  <td className="p-2.5 border-r border-[#DEE2E6] font-mono">{item.date}</td>
                                  <td className="p-2.5 border-r border-[#DEE2E6] font-medium">{item.type}</td>
                                  <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-[11px] space-y-0.5 text-gray-700">
                                    <div>Wallet - {item.oldBal.wallet}</div>
                                    <div>Deposit - {item.oldBal.deposit}</div>
                                    <div>Winning - {item.oldBal.winning}</div>
                                    <div>Commission - {item.oldBal.commission}</div>
                                    <div>Bonus - {item.oldBal.bonus}</div>
                                    <div>Referral - {item.oldBal.referral}</div>
                                  </td>
                                  <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-[11px] space-y-0.5 text-gray-700">
                                    <div>Wallet - {item.newBal.wallet}</div>
                                    <div>Deposit - {item.newBal.deposit}</div>
                                    <div>Winning - {item.newBal.winning}</div>
                                    <div>Commission - {item.newBal.commission}</div>
                                    <div>Bonus - {item.newBal.bonus}</div>
                                    <div>Referral - {item.newBal.referral}</div>
                                  </td>
                                  <td className="p-2.5 font-medium">{item.gameType}</td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}`;

if (content.includes(oldLedgerBlock)) {
  content = content.replace(oldLedgerBlock, newLedgerBlock);
  fs.writeFileSync(file, content);
  console.log('Replaced Game Ledger block successfully!');
} else {
  console.log('Could not match oldLedgerBlock');
}
