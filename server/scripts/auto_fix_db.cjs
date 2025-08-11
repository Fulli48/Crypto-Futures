const fs = require('fs');
const path = require('path');
const child = require('child_process');

const logFile = path.resolve(process.cwd(), 'server_out.log');
if (!fs.existsSync(logFile)) {
  console.error('Log file not found:', logFile);
  process.exit(1);
}

const content = fs.readFileSync(logFile, 'utf8');

const missingTable = new Set();
const missingColumn = new Set();

const relRegex = /relation "([\w_]+)" does not exist/gi;
const colRegex = /column "([\w_]+)" does not exist/gi;

let m;
while ((m = relRegex.exec(content)) !== null) missingTable.add(m[1]);
while ((m = colRegex.exec(content)) !== null) missingColumn.add(m[1]);

if (missingTable.size === 0 && missingColumn.size === 0) {
  console.log('No missing relations or columns detected in', logFile);
  process.exit(0);
}

console.log('Detected missing tables:', Array.from(missingTable));
console.log('Detected missing columns:', Array.from(missingColumn));

// Heuristic table mapping for columns
const tableHints = [
  { hint: ['rsi','macd','bollinger','stochastic','ema','bollinger_middle'], table: 'rolling_chart_data', type: 'REAL' },
  { hint: ['profit','tp_price','sl_price','entry_price','profitlikelihood','profit_likelihood','profitLikelihood'], table: 'trade_simulations', type: 'NUMERIC' },
  { hint: ['weight','performance_score','weight_value'], table: 'learning_weights', type: 'REAL' },
  { hint: ['accuracy','confidence'], table: 'ml_prediction_history', type: 'REAL' },
  { hint: ['data','json','market_conditions','indicator_values'], table: 'trade_simulations', type: 'JSONB' },
];

const alterStmts = [];

for (const t of missingTable) {
  alterStmts.push(`CREATE TABLE IF NOT EXISTS ${t} (id SERIAL PRIMARY KEY);`);
}

for (const col of missingColumn) {
  // find likely table
  let assigned = false;
  const lower = col.toLowerCase();
  for (const hint of tableHints) {
    for (const h of hint.hint) {
      if (lower.includes(h.toLowerCase())) {
        alterStmts.push(`ALTER TABLE IF EXISTS ${hint.table} ADD COLUMN IF NOT EXISTS ${col} ${hint.type};`);
        assigned = true;
        break;
      }
    }
    if (assigned) break;
  }
  if (!assigned) {
    // default to TEXT
    alterStmts.push(`-- Unknown table for column ${col}, adding to trade_simulations by default\nALTER TABLE IF EXISTS trade_simulations ADD COLUMN IF NOT EXISTS ${col} TEXT;`);
  }
}

const sql = alterStmts.join('\n');
const tmp = '/tmp/auto_fix.sql';
fs.writeFileSync(path.resolve(process.cwd(), 'server/sql/auto_fix.sql'), sql);
console.log('Wrote server/sql/auto_fix.sql with', alterStmts.length, 'statements');

// Apply via docker to Postgres container
try {
  child.execSync(`docker cp server/sql/auto_fix.sql crypto-futures-db-1:${tmp}`);
  child.execSync(`docker compose exec db psql -U postgres -d crypto_futures -f ${tmp}`, { stdio: 'inherit' });
  console.log('Applied fixes to DB');
} catch (err) {
  console.error('Failed to apply fixes:', err.message);
}

