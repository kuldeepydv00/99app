const fs = require('fs');
const file = 'backend/src/server.js';
let content = fs.readFileSync(file, 'utf8');

// I will rewrite the background worker logic to add `--` to the chart if missing.
const anchor = `// Background worker to auto-clear yesterday's results when a game's betting window opens`;
const endAnchor = `app.listen(PORT, () => {`;

const newLogic = `// Background worker to auto-clear yesterday's results when a game's betting window opens
setInterval(() => {
  try {
    const { gameSchedulesStore, declaredResultsMap, saveDiskStore } = require('./store');
    const { chartRecords } = require('./historicalChartStore');
    
    if (!gameSchedulesStore || !declaredResultsMap) return;

    let clearedAny = false;
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istDate = new Date(utc + (3600000 * 5.5));
    const currentMinutes = istDate.getHours() * 60 + istDate.getMinutes();

    // Calculate "yesterday's" date string (DD/MM/YYYY format based on how you store chart records)
    const yestUtc = new Date(utc + (3600000 * 5.5) - (24 * 60 * 60 * 1000));
    const yDay = String(yestUtc.getDate()).padStart(2, '0');
    const yMonth = String(yestUtc.getMonth() + 1).padStart(2, '0');
    const yYear = yestUtc.getFullYear();
    const yesterdayDateKey = \`\${yDay}/\${yMonth}/\${yYear}\`;

    const parseTime = (str) => {
      if (!str) return 0;
      const match = str.match(/(\\d{1,2}):(\\d{2})\\s*(AM|PM)/i);
      if (!match) return 0;
      let h = parseInt(match[1]);
      const m = parseInt(match[2]);
      const ampm = match[3].toUpperCase();
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    };

    Object.keys(declaredResultsMap).forEach(gameName => {
      const sched = gameSchedulesStore[gameName];
      if (!sched || !sched.open || !sched.close) return;
      
      const openM = parseTime(sched.open);
      const closeM = parseTime(sched.close);
      
      let isOpen = false;
      if (closeM < openM || gameName === 'Desawar') {
        isOpen = (currentMinutes >= openM || currentMinutes < closeM);
      } else {
        isOpen = (currentMinutes >= openM && currentMinutes < closeM);
      }

      if (isOpen) {
        // The game has reopened for a new day. 
        // 1. Check if a result was declared yesterday. If not, record "--"
        if (!chartRecords[yesterdayDateKey]) {
          chartRecords[yesterdayDateKey] = {};
        }
        if (!chartRecords[yesterdayDateKey][gameName]) {
          chartRecords[yesterdayDateKey][gameName] = "--";
        }

        // 2. Wipe it from the LIVE dashboard so it shows as a Live Game again
        delete declaredResultsMap[gameName];
        if (gameName === 'Desawar') delete declaredResultsMap['Disawer'];
        if (gameName === 'Disawer') delete declaredResultsMap['Desawar'];
        if (gameName === 'Shree Ganesh') delete declaredResultsMap['Shri Ganesh'];
        if (gameName === 'Shri Ganesh') delete declaredResultsMap['Shree Ganesh'];
        clearedAny = true;
      }
    });

    if (clearedAny) {
      saveDiskStore();
      console.log('[Auto-Clear] Game windows reopened. Old live results cleared, missing charts filled with --.');
    }
  } catch(e) {}
}, 60000);

`;

// Replace everything between the anchors
const regex = new RegExp(anchor + '[\\\\s\\\\S]*?' + 'app\\.listen\\(PORT, \\(\\) => \\{');
content = content.replace(regex, newLogic + 'app.listen(PORT, () => {');

fs.writeFileSync(file, content);
console.log("Patched server.js with chart history logic");
