const fs = require('fs');
const file = 'admin-panel/src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix Tab 1 (Profile)
const oldProfileDep = `                          const realDep = deposits
                            .filter(d => {
                              const dm = String(d.mobile || d.userPhone || d.user || '').replace(/[^0-9]/g, '').slice(-10);
                              return dm === cleanMobile && d.status === 'Approved';
                            })
                            .reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);`;

const newProfileDep = `                          const recordedDep = deposits
                            .filter(d => {
                              const dm = String(d.mobile || d.userPhone || d.user || '').replace(/[^0-9]/g, '').slice(-10);
                              return dm === cleanMobile && d.status === 'Approved';
                            })
                            .reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);

                          const userBidsForDep = bidsList.filter(b => {
                            const bm = String(b.mobile || b.phone || b.user || '').replace(/[^0-9]/g, '').slice(-10);
                            return bm === cleanMobile;
                          });
                          const totalBetSpent = userBidsForDep.reduce((sum, b) => sum + ((parseFloat(b.amount) || 10) * 0.9), 0);
                          const realDep = Math.max(recordedDep, (parseFloat(selectedUser.deposit_balance) || 0) + totalBetSpent);`;

if (content.includes(oldProfileDep)) {
  content = content.replace(oldProfileDep, newProfileDep);
  console.log('Patched Tab 1 Profile successfully!');
} else {
  console.log('Could not match oldProfileDep');
}

// 2. Fix Tab 6 (Game Ledger)
const oldLedgerMath = `                              events.forEach(ev => {
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
                              });`;

const newLedgerMath = `                              // Calculate initial opening funds if not in deposits array
                              const userDeps = (deposits || []).filter(d => matchesUser(d) && (d.status === 'Approved' || d.status === 'approved'));
                              const userBids = (bidsList || []).filter(b => matchesUser(b));
                              const userWds = (withdrawals || []).filter(w => matchesUser(w) && (w.status === 'Approved' || w.status === 'approved'));

                              const recordedDepSum = userDeps.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
                              const totalBetDepositDeductions = userBids.reduce((sum, b) => sum + ((parseFloat(b.amount) || 10) * 0.9), 0);
                              const totalWdDepositDeductions = userWds.reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);

                              const openingDeposit = Math.max(0, (parseFloat(selectedUser.deposit_balance) || 0) + totalBetDepositDeductions + totalWdDepositDeductions - recordedDepSum);

                              if (openingDeposit > 0) {
                                events.push({
                                  timestamp: (isNaN(signupDate) ? 0 : signupDate) + 10,
                                  dateStr: selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : '01:21:00 AM',
                                  type: 'Opening Balance / Deposit',
                                  amount: openingDeposit,
                                  amountStr: \`+\${openingDeposit.toFixed(2)}\`,
                                  gameType: 'Opening Funds',
                                  kind: 'DEPOSIT'
                                });
                              }

                              // Re-sort after opening deposit
                              events.sort((a, b) => a.timestamp - b.timestamp);

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
                                  const bonusDeduct = Math.min(ev.amount * 0.10, runBonus);
                                  runBonus = parseFloat((runBonus - bonusDeduct).toFixed(2));
                                  let rem = ev.amount - bonusDeduct;

                                  if (runDeposit >= rem) {
                                    runDeposit = parseFloat((runDeposit - rem).toFixed(2));
                                    rem = 0;
                                  } else {
                                    rem = parseFloat((rem - runDeposit).toFixed(2));
                                    runDeposit = 0.00;
                                    if (runWinning >= rem) {
                                      runWinning = parseFloat((runWinning - rem).toFixed(2));
                                      rem = 0;
                                    } else {
                                      rem = parseFloat((rem - runWinning).toFixed(2));
                                      runWinning = 0.00;
                                    }
                                  }
                                  runWallet = parseFloat(Math.max(0, runDeposit + runWinning + runCommission).toFixed(2));
                                } else if (ev.kind === 'WIN') {
                                  runWinning = parseFloat((runWinning + ev.amount).toFixed(2));
                                  runWallet = parseFloat((runDeposit + runWinning + runCommission).toFixed(2));
                                } else if (ev.kind === 'WITHDRAW') {
                                  let rem = ev.amount;
                                  if (runWinning >= rem) {
                                    runWinning = parseFloat((runWinning - rem).toFixed(2));
                                  } else {
                                    rem = parseFloat((rem - runWinning).toFixed(2));
                                    runWinning = 0.00;
                                    runDeposit = parseFloat(Math.max(0, runDeposit - rem).toFixed(2));
                                  }
                                  runWallet = parseFloat(Math.max(0, runDeposit + runWinning + runCommission).toFixed(2));
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
                              });`;

if (content.includes(oldLedgerMath)) {
  content = content.replace(oldLedgerMath, newLedgerMath);
  console.log('Patched Tab 6 Game Ledger math successfully!');
} else {
  console.log('Could not match oldLedgerMath');
}

fs.writeFileSync(file, content);
