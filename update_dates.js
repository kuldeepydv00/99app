const fs = require('fs');
let content = fs.readFileSync('admin-panel/src/App.tsx', 'utf-8');

const regex = /<input\s+type="date"\s+value={([^}]+)}\s+onChange={([^}]+)}\s*(?:placeholder="[^"]*"\s*)?className="([^"]+)"\s*\/>/g;

content = content.replace(regex, (match, val, onCh, cls) => {
    // If it's a date input, wrap it
    // Ensure padding on the right so text doesn't overlap icon
    const newCls = cls.includes('pr-8') ? cls : cls + ' pr-8';
    
    return `<div className="relative flex items-center w-full">
                      <input 
                        type="date" 
                        value={${val}} 
                        onChange={${onCh}} 
                        onClick={(e) => (e.target as any).showPicker && (e.target as any).showPicker()}
                        className="${newCls}"
                        style={{ color: ${val} ? '#212529' : 'transparent', textShadow: ${val} ? 'none' : '0 0 0 #495057' }}
                      />
                      <svg className="absolute right-2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                      </svg>
                    </div>`;
});

fs.writeFileSync('admin-panel/src/App.tsx', content, 'utf-8');
console.log("Updated date inputs!");
