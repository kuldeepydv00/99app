const fs = require('fs');
const file = 'website/src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const anchor = `      const closeMins = h * 60 + m;

      if (gameName === 'Desawar') {
        if (currentMins >= 4 * 60 && currentMins < 5 * 60) return false;
        return true;
      }

      return currentMins < closeMins;`;

const replacement = `      const cleanOpen = sched.open.replace('IST', '').trim();
      const oParts = cleanOpen.split(' ');
      const oTimeParts = oParts[0].split(':');
      let oh = parseInt(oTimeParts[0]);
      const om = parseInt(oTimeParts[1]);
      const oAmpm = oParts[1];

      if (oAmpm === 'PM' && oh < 12) oh += 12;
      if (oAmpm === 'AM' && oh === 12) oh = 0;
      
      const openMins = oh * 60 + om;
      const closeMins = h * 60 + m;

      // Desawar often crosses midnight (e.g. Open 10:00 AM, Close 04:00 AM)
      if (closeMins < openMins || gameName === 'Desawar') {
        return currentMins >= openMins || currentMins < closeMins;
      }

      return currentMins >= openMins && currentMins < closeMins;`;

content = content.replace(anchor, replacement);
fs.writeFileSync(file, content);
console.log("Patched!");
