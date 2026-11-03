import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const publicRoot = path.join(root, "public");
const sourceRoots = ["src", "public"];
const imageExtensions = new Set([".avif", ".gif", ".heic", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
const references = new Map();
const files = [];

async function walk(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === "ENOENT") return; throw error; }
  for (const entry of entries) {
    if (["node_modules", ".git", "dist", ".output"].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.isFile()) files.push(full);
  }
}

await Promise.all(sourceRoots.map((directory) => walk(path.join(root, directory))));
const rootHtml = path.join(root, "index.html");
try { await stat(rootHtml); files.push(rootHtml); } catch {}
const sourceFiles = files.filter((file) => /\.(?:tsx?|jsx?|css|html|json|md)$/i.test(file) && !file.endsWith("audit-public-images.mjs"));
for (const file of sourceFiles) {
  const text = await readFile(file, "utf8");
  const patterns = [/(?:src|href|poster)\\s*=\\s*["\\x27]([^"\\x27]+\\.(?:avif|gif|heic|jpe?g|png|svg|webp)(?:\\?[^"\\x27]*)?)["\\x27]/gi, /\\b(?:from\\s*|import\\s*)["\\x27]([^"\\x27]+\\.(?:avif|gif|heic|jpe?g|png|svg|webp)(?:\\?[^"\\x27]*)?)["\\x27]/gi, /["\\x27](\\/images\\/[^"\\x27]+)["\\x27]/gi, /url\\(\\s*["\\x27]?([^)"\\x27]+\\.(?:avif|gif|heic|jpe?g|png|svg|webp))["\\x27]?\\s*\\)/gi];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const raw = match[1].split("?")[0];
      if (/^(?:https?:|data:|blob:|#|\/\/)/i.test(raw) && !raw.startsWith("/images/")) continue;
      let candidate;
      if (raw.startsWith("/")) candidate = path.join(publicRoot, raw.slice(1));
      else if (raw.startsWith("@/assets/")) candidate = path.join(root, "src/assets", raw.slice("@/assets/".length));
      else if (raw.startsWith("../") || raw.startsWith("./")) candidate = path.resolve(path.dirname(file), raw);
      else continue;
      if (!imageExtensions.has(path.extname(candidate).toLowerCase())) continue;
      const relative = path.relative(root, candidate).replaceAll("\\", "/");
      if (!references.has(relative)) references.set(relative, []);
      references.get(relative).push(path.relative(root, file).replaceAll("\\", "/"));
    }
  }
}

const missing = [];
for (const [relative, usedBy] of references) {
  try { await stat(path.join(root, relative)); }
  catch {
    const directory = path.dirname(path.join(root, relative));
    let siblings = [];
    try { siblings = await readdir(directory); } catch {}
    const expected = path.basename(relative).toLowerCase();
    const caseMatch = siblings.find((name) => name.toLowerCase() === expected);
    missing.push({ path: relative, usedBy: [...new Set(usedBy)], possibleCaseMismatch: caseMatch && caseMatch !== path.basename(relative) ? caseMatch : undefined });
  }
}
const referenced = new Set(references.keys());
const publicImages = files.filter((file) => imageExtensions.has(path.extname(file).toLowerCase()) && file.startsWith(publicRoot)).map((file) => path.relative(root, file).replaceAll("\\", "/"));
const unused = publicImages.filter((file) => !referenced.has(file));
const report = { scannedSourceFiles: sourceFiles.length, referencedImages: references.size, missing, unusedPublicImages: unused };
console.log(JSON.stringify(report, null, 2));
if (missing.length) process.exitCode = 1;