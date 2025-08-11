const fs = require('fs'); 
const path = require('path'); 
 
function walk(dir) { 
  const files = []; 
  for (const f of fs.readdirSync(dir)) { 
    const fp = path.join(dir, f); 
    const stat = fs.statSync(fp); 
    if (stat.isDirectory()) files.push(...walk(fp)); 
    else if (fp.endsWith('.ts')) files.push(fp); 
  } 
  return files; 
} 
 
const serverDir = path.resolve(process.cwd(), 'server'); 
const files = walk(serverDir); 
let found = false; 
for (const f of files) { 
  const s = fs.readFileSync(f, 'utf8'); 
  const lines = s.split(/\r?\n/); 
