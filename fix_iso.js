const fs = require('fs');
const file = 'admin-panel/src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add safe helper functions at top
const helperDefs = `
const safeToISO = (val: any) => {
  if (!val) return new Date().toISOString();
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch (e) {}
  return new Date().toISOString();
};

const safeGetTime = (val: any, fallback = 0) => {
  if (!val) return fallback;
  try {
    const d = new Date(val);
    const t = d.getTime();
    if (!isNaN(t)) return t;
  } catch (e) {}
  return fallback;
};
`;

if (!content.includes('const safeToISO')) {
  content = content.replace("const API_BASE = typeof window", helperDefs + "\nconst API_BASE = typeof window");
}

// 2. Fix line 338
content = content.replace(
  "const bDate = b.rawDate || b.date || (b.created_at ? new Date(b.created_at).toISOString() : new Date().toISOString());",
  "const bDate = b.rawDate || b.date || safeToISO(b.created_at);"
);

// 3. Fix line 564
content = content.replace(
  "rawDate: b.created_at || new Date().toISOString(),",
  "rawDate: safeToISO(b.created_at),"
);

// 4. Fix line 582
content = content.replace(
  "rawDate: r.created_at || r.date || new Date().toISOString(),",
  "rawDate: safeToISO(r.created_at || r.date),"
);

// 5. Fix lines in Global Game Ledger tab around 3116, 3132, 3149
content = content.replace(
  "date: b.date || (b.created_at ? new Date(b.created_at).toISOString() : new Date().toISOString()),",
  "date: b.date || safeToISO(b.created_at),"
);
content = content.replace(
  "rawDate: b.created_at ? new Date(b.created_at).getTime() : (b.date ? new Date(b.date).getTime() : 0),",
  "rawDate: safeGetTime(b.created_at, safeGetTime(b.date, 0)),"
);

content = content.replace(
  "date: d.date || (d.createdAt ? new Date(d.createdAt).toISOString() : new Date().toISOString()),",
  "date: d.date || safeToISO(d.createdAt),"
);
content = content.replace(
  "rawDate: d.createdAt ? new Date(d.createdAt).getTime() : (d.date ? new Date(d.date).getTime() : 0),",
  "rawDate: safeGetTime(d.createdAt, safeGetTime(d.date, 0)),"
);

content = content.replace(
  "date: w.date || (w.createdAt ? new Date(w.createdAt).toISOString() : new Date().toISOString()),",
  "date: w.date || safeToISO(w.createdAt),"
);
content = content.replace(
  "rawDate: w.createdAt ? new Date(w.createdAt).getTime() : (w.date ? new Date(w.date).getTime() : 0),",
  "rawDate: safeGetTime(w.createdAt, safeGetTime(w.date, 0)),"
);

// 6. Fix date sorting around line 3315
content = content.replace(
  "const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();",
  "const dateDiff = safeGetTime(b.date) - safeGetTime(a.date);"
);

fs.writeFileSync(file, content);
console.log('Fixed all date parsing safely!');
