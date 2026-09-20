const fs = require('fs');
const file = 'backend/src/controllers/adminController.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("module.exports = {\\n  deleteUser,\\n  deleteAdminBid,", "module.exports = {\n  deleteUser,\n  deleteAdminBid,");

fs.writeFileSync(file, content);
