const fs = require('fs'); 
const path = require('path'); 
let s = fs.readFileSync('server/index.ts','utf8'); 
const old = 'import path from \"path\";\r\nimport fs from \"fs\";'; 
