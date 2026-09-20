const fs = require('fs');
const file = 'admin-panel/src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldCode = `                        {(() => {
                          const realDep = deposits
                            .filter(d => (d.userId === selectedUser.id || d.user === selectedUser.name || (d.mobile && d.mobile.includes(selectedUser.mobile))) && d.status === 'Approved')
                            .reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0) || (selectedUser.deposit_balance !== undefined ? selectedUser.deposit_balance : 0);

                          const realWin = (winningsList || [])
                            .filter(w => w.user === selectedUser.name || w.phone === selectedUser.mobile)
                            .reduce((sum, w) => sum + (parseFloat(w.win_amount || w.amount) || 0), 0) || (selectedUser.winning_balance !== undefined ? selectedUser.winning_balance : 0);

                          const realWd = withdrawals
                            .filter(w => (w.userId === selectedUser.id || w.user === selectedUser.name) && w.status === 'Approved')
                            .reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);`;

const newCode = `                        {(() => {
                          const cleanMobile = String(selectedUser.mobile || '').replace(/[^0-9]/g, '').slice(-10);

                          const realDep = deposits
                            .filter(d => {
                              const dm = String(d.mobile || d.userPhone || d.user || '').replace(/[^0-9]/g, '').slice(-10);
                              return dm === cleanMobile && d.status === 'Approved';
                            })
                            .reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);

                          const realWin = (winningsList || [])
                            .filter(w => {
                              const wm = String(w.mobile || w.phone || w.user || '').replace(/[^0-9]/g, '').slice(-10);
                              return wm === cleanMobile;
                            })
                            .reduce((sum, w) => sum + (parseFloat(w.win_amount || w.amount) || 0), 0);

                          const realWd = withdrawals
                            .filter(w => {
                              const wm = String(w.mobile || w.userPhone || w.user || '').replace(/[^0-9]/g, '').slice(-10);
                              return wm === cleanMobile && w.status === 'Approved';
                            })
                            .reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync(file, content);
  console.log('Patched User Details successfully!');
} else {
  console.log('Could not find the block to replace.');
}
