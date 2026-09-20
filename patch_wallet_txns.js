const fs = require('fs');
const file = 'admin-panel/src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldTab3 = `                  {/* TAB 3: WALLET TRANSACTIONS */}
                  {userDetailsTab === 'walletTransaction' && (
                    <div className="p-4 space-y-4 text-xs">
                      <h3 className="font-bold text-[#212529] text-sm">Wallet Transaction History</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6] whitespace-nowrap">
                          <thead className="bg-[#F8F9FA] text-[#495057] font-bold border-b border-[#DEE2E6]">
                            <tr>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Sr. No</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Txn ID</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Type</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Amount</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Date</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const userDeps = deposits.filter(d => d.userId === selectedUser.id || d.user === selectedUser.name || (d.mobile && d.mobile.includes(selectedUser.mobile)));
                              const userWds = withdrawals.filter(w => w.userId === selectedUser.id || w.user === selectedUser.name || (w.mobile && w.mobile.includes(selectedUser.mobile)));

                              const realTxns = [
                                {
                                  id: \`bonus_\${selectedUser.id || selectedUser.mobile}\`,
                                  type: 'Joining Bonus',
                                  amount: '+₹200.00',
                                  date: selectedUser.createdAt ? selectedUser.createdAt.replace('T', ' ').slice(0, 19) : '2026-08-29 09:50:00',
                                  status: 'Approved'
                                },
                                ...userDeps.map((d, idx) => ({ id: \`dep_\${d.id || idx}\`, type: d.payment_method ? \`Deposit (\${d.payment_method})\` : 'Deposit UPI', amount: \`+₹\${d.amount}.00\`, date: d.date || d.created_at || 'Today', status: d.status || 'Approved' })),
                                ...userWds.map((w, idx) => ({ id: \`wd_\${w.id || idx}\`, type: 'Withdrawal', amount: \`-₹\${w.amount}.00\`, date: w.date || w.created_at || 'Today', status: w.status || 'Approved' }))
                              ];

                              return realTxns.map((item, i) => (
                                <tr key={i} className="hover:bg-[#F4F6F9]">
                                  <td className="p-2.5 border-r border-[#DEE2E6]">{i + 1}</td>
                                  <td className="p-2.5 border-r border-[#DEE2E6] font-mono">{item.id}</td>
                                  <td className="p-2.5 border-r border-[#DEE2E6] font-bold">{item.type}</td>
                                  <td className={\`p-2.5 border-r border-[#DEE2E6] font-mono font-bold \${item.amount.startsWith('+') ? 'text-[#28A745]' : 'text-[#DC3545]'}\`}>{item.amount}</td>
                                  <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-gray-600">{item.date}</td>
                                  <td className="p-2.5 border-r border-[#DEE2E6]"><span className="px-2 py-0.5 rounded bg-[#28A745] text-white text-[10px] font-bold">{item.status}</span></td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}`;

const newTab3 = `                  {/* TAB 3: WALLET TRANSACTIONS */}
                  {userDetailsTab === 'walletTransaction' && (
                    <div className="p-4 space-y-4 text-xs">
                      <h3 className="font-bold text-[#212529] text-sm">Wallet Transaction History</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-[#212529] border border-[#DEE2E6] whitespace-nowrap">
                          <thead className="bg-[#F8F9FA] text-[#495057] font-bold border-b border-[#DEE2E6]">
                            <tr>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Sr. No</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Txn ID</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Type</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Amount</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Date</th>
                              <th className="p-2.5 border-r border-[#DEE2E6]">Status</th>
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

                              const userDeps = (deposits || []).filter(d => matchesUser(d));
                              const userWds = (withdrawals || []).filter(w => matchesUser(w));
                              const userBids = (bidsList || []).filter(b => matchesUser(b));

                              const allTxns: any[] = [
                                {
                                  id: \`bonus_\${selectedUser.id || selectedUser.mobile}\`,
                                  type: 'Joining Bonus',
                                  amount: '+₹200.00',
                                  date: selectedUser.createdAt ? selectedUser.createdAt.replace('T', ' ').slice(0, 19) : 'Today',
                                  status: 'Approved',
                                  rawDate: selectedUser.createdAt ? new Date(selectedUser.createdAt).getTime() : 0
                                },
                                ...userDeps.map((d, idx) => ({
                                  id: String(d._id || d.id || \`dep_\${idx}\`),
                                  type: d.method || d.payment_method ? \`Deposit (\${d.method || d.payment_method})\` : 'Deposit',
                                  amount: \`+₹\${(parseFloat(d.amount) || 0).toFixed(2)}\`,
                                  date: d.date || d.createdAt || 'Today',
                                  status: d.status || 'Approved',
                                  rawDate: d.createdAt ? new Date(d.createdAt).getTime() : 1
                                })),
                                ...userBids.map((b, idx) => ({
                                  id: String(b.id || \`bet_\${idx}\`),
                                  type: \`Bet Placed (\${b.category || 'Game'} - #\${b.number})\`,
                                  amount: \`-₹\${(parseFloat(b.amount) || 0).toFixed(2)}\`,
                                  date: b.date || 'Today',
                                  status: b.status || 'Pending',
                                  rawDate: b.rawDate ? new Date(b.rawDate).getTime() : 2
                                })),
                                ...userWds.map((w, idx) => ({
                                  id: String(w._id || w.id || \`wd_\${idx}\`),
                                  type: 'Withdrawal',
                                  amount: \`-₹\${(parseFloat(w.amount) || 0).toFixed(2)}\`,
                                  date: w.date || w.createdAt || 'Today',
                                  status: w.status || 'Pending',
                                  rawDate: w.createdAt ? new Date(w.createdAt).getTime() : 3
                                }))
                              ];

                              allTxns.sort((a, b) => b.rawDate - a.rawDate);

                              return allTxns.map((item, i) => (
                                <tr key={i} className="hover:bg-[#F4F6F9]">
                                  <td className="p-2.5 border-r border-[#DEE2E6]">{i + 1}</td>
                                  <td className="p-2.5 border-r border-[#DEE2E6] font-mono">{item.id}</td>
                                  <td className="p-2.5 border-r border-[#DEE2E6] font-bold">{item.type}</td>
                                  <td className={\`p-2.5 border-r border-[#DEE2E6] font-mono font-bold \${item.amount.startsWith('+') ? 'text-[#28A745]' : 'text-[#DC3545]'}\`}>{item.amount}</td>
                                  <td className="p-2.5 border-r border-[#DEE2E6] font-mono text-gray-600">{item.date}</td>
                                  <td className="p-2.5 border-r border-[#DEE2E6]"><span className={\`px-2 py-0.5 rounded text-white text-[10px] font-bold \${item.status === 'Approved' || item.status === 'Won' ? 'bg-[#28A745]' : (item.status === 'Rejected' || item.status === 'Lost' ? 'bg-[#DC3545]' : 'bg-[#007BFF]')}\`}>{item.status}</span></td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}`;

if (content.includes(oldTab3)) {
  content = content.replace(oldTab3, newTab3);
  fs.writeFileSync(file, content);
  console.log('Replaced Tab 3 block successfully!');
} else {
  console.log('Could not match oldTab3');
}
