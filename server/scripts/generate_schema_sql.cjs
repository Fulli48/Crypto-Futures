const fs = require('fs');
const path = require('path');

const input = path.resolve(__dirname, '../../shared/schema.ts');
const output = path.resolve(__dirname, '../sql/generated_schema.sql');

if (!fs.existsSync(input)) {
  console.error('schema.ts not found:', input);
  process.exit(1);
}

const src = fs.readFileSync(input, 'utf8');

// Very small heuristic parser: find pgTable("name", { ... }); blocks
const tableRegex = /export const (\w+) = pgTable\("([\w_]+)",\s*\{([\s\S]*?)\}\);/g;
const colRegex = /([\w0-9]+):\s*([a-zA-Z0-9_\.]+)\((?:"([\w_]+)"(?:,\s*\{([^\}]*)\})?)?/g;

let out = '-- Generated schema (best-effort)\n\n';
let m;
while ((m = tableRegex.exec(src)) !== null) {
  const varName = m[1];
  const tableName = m[2];
  const body = m[3];

  out += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
  out += '  id SERIAL PRIMARY KEY,\n';

  let cm;
  while ((cm = colRegex.exec(body)) !== null) {
    const prop = cm[1];
    const func = cm[2];
    const colName = cm[3] || prop;

    // map common types to SQL
    let sqlType = 'TEXT';
    if (func.includes('text')) sqlType = 'TEXT';
    else if (func.includes('decimal')) sqlType = 'NUMERIC';
    else if (func.includes('real')) sqlType = 'REAL';
    else if (func.includes('timestamp')) sqlType = 'TIMESTAMPTZ';
    else if (func.includes('integer') || func.includes('serial')) sqlType = 'INTEGER';
    else if (func.includes('boolean')) sqlType = 'BOOLEAN';
    else if (func.includes('json')) sqlType = 'JSONB';

    out += `  ${colName} ${sqlType},\n`;
  }

  // remove trailing comma
  out = out.replace(/,\n$/, '\n');
  out += '\n);\n\n';

  // reset regex lastIndex for colRegex to parse next table body correctly
  colRegex.lastIndex = 0;
}

fs.writeFileSync(output, out);
console.log('Generated SQL at', output);

