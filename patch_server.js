const fs = require('fs');
const file = 'backend/src/server.js';
let content = fs.readFileSync(file, 'utf8');

const anchor = "app.listen(PORT, () => {";
const replacement = `
// Background worker to auto-clear yesterday's results when a game's betting window opens
setInterval(() => {
  try {
    const { gameSchedulesStore, declaredResultsMap, saveDiskStore } = require('./store');
    if (!gameSchedulesStore || !declaredResultsMap) return;

    let clearedAny = false;
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istDate = new Date(utc + (3600000 * 5.5));
    const currentMinutes = istDate.getHours() * 60 + istDate.getMinutes();

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
      console.log('[Auto-Clear] Wiped old results because betting windows opened.');
    }
  } catch(e) {}
}, 60000);

app.listen(PORT, () => {
`;

content = content.replace(anchor, replacement);
fs.writeFileSync(file, content);
console.log("Patched server.js with auto-clear result logic");
