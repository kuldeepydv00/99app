const fs = require('fs');
const file = 'admin-panel/src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const anchorInit = `const [resultForm, setResultForm] = useState({ category: 'Desawar', resultDate: '29-08-2026', resultNumber: '', reResultNumber: '' });`;
const repInit = `const [resultForm, setResultForm] = useState({ category: 'Desawar', resultDate: new Date().toISOString().split('T')[0], resultNumber: '', reResultNumber: '' });`;

const anchorReset = `setResultForm({ category: 'Desawar', resultDate: '29-08-2026', resultNumber: '', reResultNumber: '' });`;
const repReset = `setResultForm({ category: 'Desawar', resultDate: new Date().toISOString().split('T')[0], resultNumber: '', reResultNumber: '' });`;

const anchorInput = `<input type="text" value={resultForm.resultDate} onChange={(e)=>setResultForm({...resultForm, resultDate: e.target.value})} required className="w-full border border-[#CED4DA] p-2 rounded font-bold text-center" />`;
const repInput = `<input type="date" value={resultForm.resultDate} onChange={(e)=>setResultForm({...resultForm, resultDate: e.target.value})} required className="w-full border border-[#CED4DA] p-2 rounded font-bold text-center" />`;

content = content.replace(anchorInit, repInit);
content = content.replace(anchorReset, repReset);
content = content.replace(anchorInput, repInput);

fs.writeFileSync(file, content);
console.log("Patched admin-panel calendar");
