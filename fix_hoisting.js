const fs = require('fs');
const file = 'backend/src/controllers/adminController.js';
let content = fs.readFileSync(file, 'utf8');

const exportBlockMatch = content.match(/module\.exports = {[\s\S]*?};/);
if (exportBlockMatch) {
  const exportBlock = exportBlockMatch[0];
  content = content.replace(exportBlock, '');
  content = content + '\n' + exportBlock + '\n';
  fs.writeFileSync(file, content);
  console.log("Moved exports to bottom");
} else {
  console.log("Export block not found");
}
