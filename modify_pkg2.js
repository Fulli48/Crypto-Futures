var fs = require('fs'); 
var p = JSON.parse(fs.readFileSync('package.json','utf8')); 
p.scripts['build:server'] = 'esbuild ./scripts/pack-entry.mjs --bundle --platform=node --target=node18 --outfile=./dist/server/index.js --format=cjs --external:vite --external:lightningcss --external:@babel/* --external:jiti --external:@tailwindcss/* --external:tailwindcss-animate --external:webpack --external:esbuild'; 
p.scripts['build:exe'] = 'npx pkg ./dist/server/index.js --targets node18-win-x64 --output ./dist/crypto-futures.exe'; 
