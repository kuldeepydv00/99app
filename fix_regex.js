const fs = require('fs');
const file = 'backend/src/controllers/adminController.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("query.$or.push({ mobile: new RegExp(id + '", "query.$or.push({ mobile: new RegExp(id + '$') }); // fixed");

fs.writeFileSync(file, content);
