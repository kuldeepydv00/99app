const fs = require('fs');
const file = 'backend/src/server.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("const { chartRecords } = require('./historicalChartStore');", "");
content = content.replace(/if \(!chartRecords\[yesterdayDateKey\]\).*?\.gameName\] = "--";\n/gs, "");
content = content.replace(/if \(!chartRecords\[yesterdayDateKey\]\) {[\s\S]*?}/gs, "");
content = content.replace(/if \(!chartRecords\[yesterdayDateKey\]\[gameName\]\) {[\s\S]*?}/gs, "");

fs.writeFileSync(file, content);
console.log("Patched server.js");
