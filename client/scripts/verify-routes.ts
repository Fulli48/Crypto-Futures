import fs from "fs";
import path from "path";

const OUT = path.resolve(__dirname, "..", "src", "auto-routes.generated.tsx");
if (!fs.existsSync(OUT)) { console.error("Missing generated routes:", OUT); process.exit(2); }

const content = fs.readFileSync(OUT, "utf8");
const re = /import\s+([A-Za-z0-9_]+)\s+from\s+"([^"]+)";/g;
let ok = true, m: RegExpExecArray | null;
while ((m = re.exec(content))) {
  const importPath = path.resolve(__dirname, "..", "src", m[2]);
  const candidate = fs.existsSync(importPath + ".tsx") ? (importPath + ".tsx") : importPath;
  if (!fs.existsSync(candidate)) { console.error("Missing page file for import:", m[2]); ok = false; continue; }
  const src = fs.readFileSync(candidate, "utf8");
  if (!/export\s+default\s+/m.test(src)) { console.error("No default export in:", m[2]); ok = false; }
}
if (!ok) process.exit(3);
console.log("Route verification OK");