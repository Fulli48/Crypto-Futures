const fs = require('fs');
const path = require('path');

function walk(dir) {
  let out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

const files = walk(path.resolve(process.cwd(), 'server'));
let found = false;
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  const lines = s.split(/\r?\n/);
  lines.forEach((line, idx) => {
    if (line.includes('await import(') || line.includes('import.meta')) {
      console.log(`${f}:${idx+1}: ${line.trim()}`);
      found = true;
    }
  });
}
if (!found) console.log('No matches found');

