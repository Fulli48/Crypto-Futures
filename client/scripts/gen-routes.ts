import fs from "fs";
import path from "path";

const PAGES_DIR = path.resolve(__dirname, "..", "src", "pages");
const OUT = path.resolve(__dirname, "..", "src", "auto-routes.generated.tsx");

function isAscii(s: string) { return /^[\x00-\x7F]*$/.test(s); }
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (!isAscii(p)) continue;
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile() && p.endsWith(".tsx")) out.push(p);
  }
  return out;
}
function hasDefaultExport(file: string): boolean {
  const src = fs.readFileSync(file, "utf8");
  return /export\s+default\s+/m.test(src);
}
function routePath(fromPages: string): string {
  const rel = fromPages.replace(PAGES_DIR + path.sep, "").replace(/\\/g, "/");
  if (rel === "index.tsx") return "/";
  if (rel.endsWith("/index.tsx")) return "/" + rel.replace(/\/index\.tsx$/, "");
  return "/" + rel.replace(/\.tsx$/, "");
}
function importName(p: string): string {
  const rel = p.replace(PAGES_DIR + path.sep, "").replace(/\\/g, "/").replace(/[^A-Za-z0-9]/g, "_");
  return "Pg_" + rel.replace(/_tsx$/, "");
}

const files = walk(PAGES_DIR).filter(f => !/-broken\.tsx$/.test(f)).filter(hasDefaultExport).sort((a,b)=>a.localeCompare(b));
const imports: string[] = [];
const routes: string[] = [];
for (const f of files) {
  const name = importName(f);
  const relImport = "./" + path.relative(path.resolve(__dirname, "..", "src"), f).replace(/\\/g,"/");
  imports.push(`import ${name} from "${relImport}";`);
  routes.push(`  <Route key="${routePath(f)}" path="${routePath(f)}" element={<${name} />} />`);
}

const out =
`/* AUTO-GENERATED. DO NOT EDIT. ASCII ONLY. */
import React from "react";
import { Routes, Route } from "react-router-dom";
${imports.join("\n")}

export default function AppRoutes() {
  return (
    <Routes>
${routes.join("\n")}
    </Routes>
  );
}
`;

fs.writeFileSync(OUT, out.replace(/[^\x00-\x7F]/g, ""), "utf8");
console.log("Wrote", OUT, "with", files.length, "routes");