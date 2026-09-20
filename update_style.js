const fs = require('fs');
let content = fs.readFileSync('admin-panel/src/App.tsx', 'utf-8');
content = content.replace(/\s*style={{ color:[^}]+}}/g, '');
fs.writeFileSync('admin-panel/src/App.tsx', content, 'utf-8');
console.log("Removed style hack!");
