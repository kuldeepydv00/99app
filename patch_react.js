const fs = require('fs');
let code = fs.readFileSync('admin-panel/src/App.tsx', 'utf8');

const oldDelete = `onClick={() => setUsers(users.filter(x => x.id !== u.id))}`;
const newDelete = `onClick={async () => {
                                    if (window.confirm('Are you sure you want to permanently delete this user?')) {
                                      try {
                                        const res = await fetch(\`\${API_BASE}/api/admin/users/\${u.id}\`, { method: 'DELETE' });
                                        const data = await res.json();
                                        if (data.success) {
                                          setUsers(users.filter(x => x.id !== u.id));
                                          alert('User deleted permanently.');
                                        } else {
                                          alert('Failed to delete user.');
                                        }
                                      } catch (err) {
                                        alert('Error deleting user.');
                                      }
                                    }
                                  }}`;

code = code.replace(oldDelete, newDelete);
fs.writeFileSync('admin-panel/src/App.tsx', code);
console.log('Patched App.tsx');
