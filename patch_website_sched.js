const fs = require('fs');
const file = 'website/src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add gameSchedules state
content = content.replace(
  /const \[declaredResults, setDeclaredResults\] = useState<Record<string, number>>\({}\);/,
  `const [declaredResults, setDeclaredResults] = useState<Record<string, number>>({});\n  const [gameSchedules, setGameSchedules] = useState<Record<string, GameSchedule>>(DEFAULT_SCHEDULES);`
);

// 2. Add fetch logic
const fetchLogic = `      // Fetch Results
      const rRes = await fetchApi('/api/game/results');
      if (rRes.ok) {
        const rData = await rRes.json();
        setDeclaredResults(rData);
      }

      // Fetch Schedules
      const sRes = await fetchApi('/api/admin/schedules');
      if (sRes.ok) {
        const sData = await sRes.json();
        if (Object.keys(sData).length > 0) {
          setGameSchedules(sData);
        }
      }`;
content = content.replace(
  /\/\/ Fetch Results[\s\S]*?setDeclaredResults\(rData\);\n      \}/,
  fetchLogic
);

// 3. Replace DEFAULT_SCHEDULES usage inside the render tree
content = content.replace(/DEFAULT_SCHEDULES\[gameName\]/g, 'gameSchedules[gameName]');
content = content.replace(/Object\.keys\(DEFAULT_SCHEDULES\)/g, 'Object.keys(gameSchedules)');

fs.writeFileSync(file, content);
console.log("Patched App.tsx");
