const fs = require('fs');
const file = 'backend/src/controllers/gameController.js';
let content = fs.readFileSync(file, 'utf8');

const anchor = `const num = parseInt(item.number);`;
const replacement = `let num = parseInt(item.number);
    if (num === 100) num = 0; // Fix Android App sending 100 for 00`;

content = content.replace(anchor, replacement);
fs.writeFileSync(file, content);
console.log("Patched gameController");
